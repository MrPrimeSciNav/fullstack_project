from flask import Flask, render_template, request, jsonify, send_file
import os
import json
import serial
import serial.tools.list_ports
import ftplib
import socket
import threading
import time
from werkzeug.utils import secure_filename
import zipfile
import tempfile

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 3 * 1024 * 1024  # 3 MB max file size

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

class BoardManager:
    def __init__(self):
        self.boards = []
        self.load_boards()
    
    def load_boards(self):
        """Load board configurations from pymakr.conf files"""
        try:
            # Load from current project
            if os.path.exists('../pymakr.conf'):
                with open('../pymakr.conf', 'r') as f:
                    config = json.load(f)
                    self.boards.append({
                        'id': 'current',
                        'name': config.get('name', 'Current Project'),
                        'address': config.get('address', ''),
                        'username': config.get('username', 'micro'),
                        'password': config.get('password', 'python'),
                        'main_file': config.get('main_file', 'main.py'),
                        'type': 'wifi'
                    })
        except Exception as e:
            print(f"Error loading board config: {e}")
    
    def get_serial_ports(self):
        """Get available serial ports"""
        ports = []
        for port in serial.tools.list_ports.comports():
            ports.append({
                'device': port.device,
                'description': port.description,
                'hwid': port.hwid
            })
        return ports
    
    def test_wifi_connection(self, address, username, password):
        """Test WiFi/FTP connection to board"""
        try:
            ftp = ftplib.FTP()
            ftp.connect(address, 21, timeout=10)
            ftp.login(username, password)
            ftp.quit()
            return True, "Connection successful"
        except Exception as e:
            return False, str(e)
    
    def test_serial_connection(self, port, baudrate=115200):
        """Test serial connection to board"""
        try:
            ser = serial.Serial(port, baudrate, timeout=2)
            ser.write(b'\r\n')
            time.sleep(0.5)
            response = ser.read_all()
            ser.close()
            return True, "Serial connection successful"
        except Exception as e:
            return False, str(e)

board_manager = BoardManager()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/boards')
def get_boards():
    return jsonify(board_manager.boards)

@app.route('/api/serial-ports')
def get_serial_ports():
    return jsonify(board_manager.get_serial_ports())

@app.route('/api/test-connection', methods=['POST'])
def test_connection():
    data = request.json
    connection_type = data.get('type')
    
    if connection_type == 'wifi':
        success, message = board_manager.test_wifi_connection(
            data.get('address'),
            data.get('username'),
            data.get('password')
        )
    elif connection_type == 'serial':
        success, message = board_manager.test_serial_connection(
            data.get('port'),
            data.get('baudrate', 115200)
        )
    else:
        success, message = False, "Unknown connection type"
    
    return jsonify({'success': success, 'message': message})

@app.route('/api/upload', methods=['POST'])
def upload_files():
    if 'files' not in request.files:
        return jsonify({'success': False, 'message': 'No files selected'})
    
    files = request.files.getlist('files')
    connection_data = json.loads(request.form.get('connection'))
    
    try:
        if connection_data['type'] == 'wifi':
            result = upload_via_ftp(files, connection_data)
        elif connection_data['type'] == 'serial':
            result = upload_via_serial(files, connection_data)
        else:
            result = {'success': False, 'message': 'Unknown connection type'}
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

def upload_via_ftp(files, connection_data):
    """Upload files via FTP"""
    try:
        ftp = ftplib.FTP()
        ftp.connect(connection_data['address'], 21, timeout=30)
        ftp.login(connection_data['username'], connection_data['password'])
        
        uploaded_files = []
        for file in files:
            if file.filename:
                filename = secure_filename(file.filename)
                # Upload file
                ftp.storbinary(f'STOR {filename}', file.stream)
                uploaded_files.append(filename)
        
        ftp.quit()
        return {'success': True, 'message': f'Uploaded {len(uploaded_files)} files', 'files': uploaded_files}
    except Exception as e:
        return {'success': False, 'message': f'FTP upload failed: {str(e)}'}

def upload_via_serial(files, connection_data):
    """Upload files via serial connection"""
    try:
        ser = serial.Serial(connection_data['port'], connection_data.get('baudrate', 115200), timeout=5)
        
        uploaded_files = []
        for file in files:
            if file.filename:
                filename = secure_filename(file.filename)
                content = file.read().decode('utf-8')
                
                # Enter raw REPL mode
                ser.write(b'\x01')  # Ctrl+A
                time.sleep(0.1)
                
                # Create file upload command
                upload_cmd = f"""
with open('{filename}', 'w') as f:
    f.write('''{content}''')
"""
                ser.write(upload_cmd.encode())
                ser.write(b'\x04')  # Ctrl+D to execute
                time.sleep(1)
                
                uploaded_files.append(filename)
        
        ser.close()
        return {'success': True, 'message': f'Uploaded {len(uploaded_files)} files via serial', 'files': uploaded_files}
    except Exception as e:
        return {'success': False, 'message': f'Serial upload failed: {str(e)}'}

@app.route('/api/download', methods=['POST'])
def download_files():
    data = request.json
    connection_data = data.get('connection')
    filenames = data.get('files', [])
    
    try:
        if connection_data['type'] == 'wifi':
            result = download_via_ftp(filenames, connection_data)
        elif connection_data['type'] == 'serial':
            result = download_via_serial(filenames, connection_data)
        else:
            result = {'success': False, 'message': 'Unknown connection type'}
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/download')
def download():
    zip_path = request.args.get('path')
    if not zip_path or not os.path.exists(zip_path):
        return "File not found", 404

    return send_file(
        zip_path,
        as_attachment=True,
        download_name='downloaded_files.zip',
        mimetype='application/zip'
    )

def download_via_ftp(filenames, connection_data):
    """Download files via FTP"""
    try:
        ftp = ftplib.FTP()
        ftp.connect(connection_data['address'], 21, timeout=30)
        ftp.login(connection_data['username'], connection_data['password'])
        
        # Create temporary zip file
        temp_dir = tempfile.mkdtemp()
        zip_path = os.path.join(temp_dir, 'downloaded_files.zip')
        
        with zipfile.ZipFile(zip_path, 'w') as zipf:
            for filename in filenames:
                try:
                    temp_file = os.path.join(temp_dir, filename)
                    with open(temp_file, 'wb') as f:
                        ftp.retrbinary(f'RETR {filename}', f.write)
                    zipf.write(temp_file, filename)
                except Exception as e:
                    print(f"Failed to download {filename}: {e}")
        
        ftp.quit()
        return {'success': True, 'zip_path': zip_path}
    except Exception as e:
        return {'success': False, 'message': f'FTP download failed: {str(e)}'}

def download_via_serial(filenames, connection_data):
    """Download files via serial connection"""
    try:
        ser = serial.Serial(connection_data['port'], connection_data.get('baudrate', 115200), timeout=5)
        
        # Create temporary zip file
        temp_dir = tempfile.mkdtemp()
        zip_path = os.path.join(temp_dir, 'downloaded_files.zip')
        
        with zipfile.ZipFile(zip_path, 'w') as zipf:
            for filename in filenames:
                try:
                    # Enter raw REPL mode
                    ser.write(b'\x01')  # Ctrl+A
                    time.sleep(0.1)
                    
                    # Read file command
                    read_cmd = f"""
                    try:
                        with open('{filename}', 'r') as f:
                            print('FILE_START')
                            print(f.read())
                            print('FILE_END')
                    except:
                        print('FILE_ERROR')
                    """
                    ser.write(read_cmd.encode())
                    ser.write(b'\x04')  # Ctrl+D to execute
                    
                    # Read response
                    response = ser.read_until(b'FILE_END').decode('utf-8', errors='ignore')
                    
                    if 'FILE_START' in response and 'FILE_END' in response:
                        content = response.split('FILE_START')[1].split('FILE_END')[0].strip()
                        zipf.writestr(filename, content)
                    
                except Exception as e:
                    print(f"Failed to download {filename}: {e}")
        
        ser.close()
        return {'success': True, 'zip_path': zip_path}
    except Exception as e:
        return {'success': False, 'message': f'Serial download failed: {str(e)}'}

@app.route('/faq')
def faq():
    return render_template('faq.html')

@app.route('/api/faq')
def get_faq_data():
    faq_data = [
        {
            "id": 1,
            "question": "What is the purpose of the Embedded Board Manager?",
            "answer": "The Embedded Board Manager is a comprehensive tool designed to simplify file management, uploading, downloading, and synchronization between your local machine and embedded boards like ESP32, Raspberry Pi, and other microcontrollers. It provides both WiFi/FTP and serial connection options for seamless board management."
        },
        {
            "id": 2,
            "question": "How can I connect my board to the internet?",
            "answer": "You can connect your board using two methods: 1) WiFi/FTP connection by entering your board's IP address, username, and password in the Connection tab, or 2) Serial connection by selecting the appropriate COM port and baud rate. Make sure your board is properly configured for the chosen connection method."
        },
        {
            "id": 3,
            "question": "What file formats are supported for upload and download?",
            "answer": "The Embedded Board Manager supports common file formats including .py (Python files), .txt (text files), .json (configuration files), and .conf (configuration files). The system has a 3MB file size limit per upload to ensure optimal performance."
        },
        {
            "id": 4,
            "question": "How do I sync files between my local machine and the board?",
            "answer": "Use the Sync tab to compare and synchronize files between your local directory and the board. The sync feature will show you differences between local and remote files, allowing you to choose which files to upload or download to maintain consistency."
        },
        {
            "id": 5,
            "question": "What should I do if I encounter connection issues?",
            "answer": "First, use the 'Test Connection' button to verify your connection settings. For WiFi connections, ensure the IP address, username, and password are correct. For serial connections, verify the COM port and baud rate. Check that your board is powered on and properly configured for the connection method you're using."
        },
        {
            "id": 6,
            "question": "Is there a limit to the file size I can upload?",
            "answer": "Yes, there is a 3MB file size limit per upload session. This limit is in place to ensure stable transfers and prevent memory issues on embedded boards. If you need to transfer larger files, consider splitting them into smaller chunks or compressing them first."
        },
        {
            "id": 7,
            "question": "Can I use the Embedded Board Manager with multiple boards?",
            "answer": "Yes, the Board Manager supports multiple board configurations. You can save different connection profiles for various boards and switch between them as needed. Each board can have its own connection settings and file management preferences."
        },
        {
            "id": 8,
            "question": "How do I update the Embedded Board Manager software?",
            "answer": "Updates are typically distributed through the official repository. Check the project's GitHub page or official website for the latest releases. Always backup your board configurations before updating to ensure you don't lose your connection settings."
        },
        {
            "id": 9,
            "question": "Where can I find more documentation and support?",
            "answer": "Comprehensive documentation is available in the project repository. For additional support, you can contact us at bigboss@primescinav.com or check the project's issue tracker for common problems and solutions."
        },
        {
            "id": 10,
            "question": "Are there any security considerations I should be aware of when using the Embedded Board Manager?",
            "answer": "Yes, always use secure passwords for your board connections. Avoid using default credentials and ensure your network is secure when using WiFi connections. For serial connections, be aware that anyone with physical access to the connection can potentially access your board."
        },
        {
            "id": 11,
            "question": "What are the limitations of the Embedded Board Manager software?",
            "answer": "Current limitations include a 3MB file size limit, support for specific file formats only, and dependency on stable network connections for WiFi transfers. Serial transfers may be slower than network transfers, and some advanced board features may require manual configuration."
        },
        {
            "id": 12,
            "question": "Is there a free version of the Embedded Board Manager available?",
            "answer": "Yes, the Embedded Board Manager is open-source software and completely free to use. You can download, modify, and distribute it according to the project's license terms."
        },
        {
            "id": 13,
            "question": "How can I contribute to the development of the Embedded Board Manager software?",
            "answer": "Contributions are welcome! You can contribute by reporting bugs, suggesting features, submitting pull requests, or improving documentation. Check the project's GitHub repository for contribution guidelines and current development needs."
        },
        {
            "id": 14,
            "question": "How can I use the Embedded Board Manager to manage my IoT devices?",
            "answer": "The Board Manager is perfect for IoT device management. You can upload configuration files, update firmware scripts, download sensor data logs, and maintain consistent code across multiple IoT devices. Use the sync feature to keep all your devices updated with the latest configurations."
        },
        {
            "id": 15,
            "question": "Can I automate file transfers using the Embedded Board Manager?",
            "answer": "While the current interface is primarily manual, the underlying Flask API can be used to create automated scripts. You can write custom scripts that interact with the API endpoints to automate repetitive file transfer tasks."
        },
        {
            "id": 16,
            "question": "What operating systems are compatible with the Embedded Board Manager?",
            "answer": "The Embedded Board Manager is built with Python and Flask, making it compatible with Windows, macOS, and Linux systems. As long as you have Python 3.6+ and the required dependencies installed, it should work on your operating system."
        },
        {
            "id": 17,
            "question": "How do I troubleshoot common issues with the Embedded Board Manager?",
            "answer": "Common troubleshooting steps include: 1) Verify connection settings, 2) Check board power and network status, 3) Ensure correct drivers are installed for serial connections, 4) Verify firewall settings for network connections, and 5) Check the console output for error messages."
        },
        {
            "id": 18,
            "question": "Can I customize the Embedded Board Manager interface?",
            "answer": "Yes, the interface can be customized by modifying the CSS files and HTML templates. The modular design allows for easy customization of colors, layouts, and functionality. Advanced users can also extend the Flask backend to add new features."
        },
        {
            "id": 19,
            "question": "How do I back up my board's data using the Embedded Board Manager?",
            "answer": "Use the Download tab to select and download all important files from your board to your local machine. You can also use the sync feature to maintain regular backups by comparing and downloading changed files automatically."
        },
        {
            "id": 20,
            "question": "What are the system requirements for running the Embedded Board Manager?",
            "answer": "Minimum requirements include: Python 3.6+, 512MB RAM, 100MB free disk space, and a network connection (for WiFi transfers) or available serial ports (for serial transfers). Modern web browser required for the interface."
        }
    ]
    
    return jsonify(faq_data)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)