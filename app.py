import os
import json
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Environment variables
CARFAX_USER = os.getenv('CARFAX_USER', 'stuart@aaronag.com')
CARFAX_PASS = os.getenv('CARFAX_PASS')
VELOCITY_USERNAME = os.getenv('VELOCITY_USERNAME', 'stuart@aaronag.com')
VELOCITY_PASSWORD = os.getenv('VELOCITY_PASSWORD')
PORT = os.getenv('PORT', 5000)

@app.route('/')
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'vehicle-descriptions',
        'timestamp': datetime.now().isoformat(),
        'message': 'Service is running - Selenium features pending'
    })

@app.route('/api/carfax', methods=['POST'])
def api_carfax():
    """Mock Carfax endpoint for testing"""
    data = request.json
    vin = data.get('vin')
    
    if not vin:
        return jsonify({'error': 'VIN is required'}), 400
    
    # Return mock data for now
    return jsonify({
        'vin': vin,
        'fetchedAt': datetime.now().isoformat(),
        'oneOwner': True,
        'noAccidents': True,
        'serviceRecords': True,
        'note': 'This is mock data - Selenium integration pending'
    })

@app.route('/api/windowsticker', methods=['POST'])
def api_window_sticker():
    """Mock Window Sticker endpoint for testing"""
    data = request.json
    vin = data.get('vin')
    
    if not vin:
        return jsonify({'error': 'VIN is required'}), 400
    
    # Return mock data for now
    return jsonify({
        'vin': vin,
        'fetchedAt': datetime.now().isoformat(),
        'year': '2024',
        'make': 'Ford',
        'model': 'F-150',
        'packages': ['XLT Package', 'Towing Package'],
        'features': ['Backup Camera', 'Bluetooth'],
        'note': 'This is mock data - Selenium integration pending'
    })

@app.route('/api/test-credentials', methods=['POST'])
def test_credentials():
    """Test credentials are configured"""
    return jsonify({
        'carfax_user': bool(CARFAX_USER),
        'carfax_pass': bool(CARFAX_PASS),
        'velocity_user': bool(VELOCITY_USERNAME),
        'velocity_pass': bool(VELOCITY_PASSWORD)
    })

if __name__ == '__main__':
    logger.info(f"Starting Vehicle Description Service on port {PORT}")
    app.run(host='0.0.0.0', port=int(PORT), debug=False)