"""
Vehicle Description Service - Render.com
Fetches Carfax and Window Sticker data for vehicle descriptions
"""

import os
import json
import time
import logging
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import requests
from werkzeug.middleware.proxy_fix import ProxyFix

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)
CORS(app)

# Load environment variables
CARFAX_USER = os.getenv('CARFAX_USER', 'stuart@aaronag.com')
CARFAX_PASS = os.getenv('CARFAX_PASS', 'vLPd8aV#n4Txpd!')
VELOCITY_USERNAME = os.getenv('VELOCITY_USERNAME', 'stuart@aaronag.com')
VELOCITY_PASSWORD = os.getenv('VELOCITY_PASSWORD', 'G5zrBj6tqk^TGNsW')
PORT = os.getenv('PORT', 5000)

def get_chrome_driver():
    """Create and return a Chrome WebDriver instance"""
    chrome_options = Options()
    chrome_options.add_argument('--headless')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument('--window-size=1920x1080')
    chrome_options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
    
    # For Render.com deployment
    chrome_options.binary_location = os.environ.get("GOOGLE_CHROME_BIN", "/usr/bin/google-chrome")
    
    driver = webdriver.Chrome(options=chrome_options)
    driver.set_page_load_timeout(30)
    
    return driver

def fetch_carfax_data(vin, username=None, password=None):
    """Fetch Carfax data for a given VIN"""
    username = username or CARFAX_USER
    password = password or CARFAX_PASS
    
    driver = None
    try:
        driver = get_chrome_driver()
        logger.info(f"Fetching Carfax data for VIN: {vin}")
        
        # Navigate to Carfax login
        driver.get("https://auth.carfax.com/u/login")
        time.sleep(3)
        
        # Login
        wait = WebDriverWait(driver, 20)
        
        # Enter username
        username_field = wait.until(
            EC.presence_of_element_located((By.ID, "username"))
        )
        username_field.clear()
        username_field.send_keys(username)
        
        # Enter password
        password_field = driver.find_element(By.ID, "password")
        password_field.clear()
        password_field.send_keys(password)
        
        # Click login button
        login_button = driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
        login_button.click()
        
        # Wait for login to complete
        time.sleep(5)
        
        # Navigate to VIN lookup
        driver.get(f"https://www.carfax.com/api/vehicle-history/{vin}")
        time.sleep(3)
        
        # Extract Carfax data
        carfax_data = {
            'vin': vin,
            'fetchedAt': datetime.now().isoformat(),
            'oneOwner': False,
            'noAccidents': False,
            'serviceRecords': False,
            'personalUse': False,
            'history': []
        }
        
        # Check for specific Carfax indicators
        page_source = driver.page_source.lower()
        
        if '1-owner' in page_source or 'one owner' in page_source:
            carfax_data['oneOwner'] = True
            
        if 'no accidents' in page_source or 'accident free' in page_source:
            carfax_data['noAccidents'] = True
            
        if 'service records' in page_source or 'maintenance records' in page_source:
            carfax_data['serviceRecords'] = True
            
        if 'personal' in page_source and 'use' in page_source:
            carfax_data['personalUse'] = True
        
        logger.info(f"Successfully fetched Carfax data for VIN: {vin}")
        return carfax_data
        
    except Exception as e:
        logger.error(f"Error fetching Carfax data: {e}")
        return {'error': str(e), 'vin': vin}
    finally:
        if driver:
            driver.quit()

def fetch_window_sticker(vin, username=None, password=None):
    """Fetch Window Sticker data for a given VIN"""
    username = username or VELOCITY_USERNAME
    password = password or VELOCITY_PASSWORD
    
    driver = None
    try:
        driver = get_chrome_driver()
        logger.info(f"Fetching Window Sticker for VIN: {vin}")
        
        # Navigate to Velocity login
        driver.get("https://app.velocityautomotive.com/windowsticker")
        time.sleep(3)
        
        # Login
        wait = WebDriverWait(driver, 20)
        
        # Enter username
        username_field = wait.until(
            EC.presence_of_element_located((By.NAME, "username"))
        )
        username_field.clear()
        username_field.send_keys(username)
        
        # Enter password
        password_field = driver.find_element(By.NAME, "password")
        password_field.clear()
        password_field.send_keys(password)
        
        # Click login
        login_button = driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
        login_button.click()
        
        # Wait for login
        time.sleep(5)
        
        # Enter VIN for lookup
        vin_field = wait.until(
            EC.presence_of_element_located((By.ID, "vin-input"))
        )
        vin_field.clear()
        vin_field.send_keys(vin)
        
        # Submit VIN
        submit_button = driver.find_element(By.ID, "submit-vin")
        submit_button.click()
        
        # Wait for sticker to load
        time.sleep(5)
        
        # Extract window sticker data
        sticker_data = {
            'vin': vin,
            'fetchedAt': datetime.now().isoformat(),
            'year': '',
            'make': '',
            'model': '',
            'trim': '',
            'packages': [],
            'features': [],
            'mpg': {}
        }
        
        # Extract vehicle info
        try:
            vehicle_info = driver.find_element(By.CLASS_NAME, "vehicle-info")
            info_text = vehicle_info.text
            lines = info_text.split('\n')
            if len(lines) > 0:
                first_line = lines[0].split()
                if len(first_line) >= 3:
                    sticker_data['year'] = first_line[0]
                    sticker_data['make'] = first_line[1]
                    sticker_data['model'] = ' '.join(first_line[2:])
        except:
            pass
        
        logger.info(f"Successfully fetched Window Sticker for VIN: {vin}")
        return sticker_data
        
    except Exception as e:
        logger.error(f"Error fetching Window Sticker: {e}")
        return {'error': str(e), 'vin': vin}
    finally:
        if driver:
            driver.quit()

# API Routes
@app.route('/', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'vehicle-descriptions',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/carfax', methods=['POST'])
def api_carfax():
    """API endpoint to fetch Carfax data"""
    try:
        data = request.json
        vin = data.get('vin')
        
        if not vin:
            return jsonify({'error': 'VIN is required'}), 400
        
        username = data.get('username')
        password = data.get('password')
        
        carfax_data = fetch_carfax_data(vin, username, password)
        return jsonify(carfax_data)
        
    except Exception as e:
        logger.error(f"API error in /api/carfax: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/windowsticker', methods=['POST'])
def api_window_sticker():
    """API endpoint to fetch Window Sticker data"""
    try:
        data = request.json
        vin = data.get('vin')
        
        if not vin:
            return jsonify({'error': 'VIN is required'}), 400
        
        username = data.get('username')
        password = data.get('password')
        
        sticker_data = fetch_window_sticker(vin, username, password)
        return jsonify(sticker_data)
        
    except Exception as e:
        logger.error(f"API error in /api/windowsticker: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    logger.info(f"Starting Vehicle Description Service on port {PORT}")
    app.run(host='0.0.0.0', port=int(PORT), debug=False)

