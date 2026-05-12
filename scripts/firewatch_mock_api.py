from http.server import BaseHTTPRequestHandler, HTTPServer
import json
from urllib.parse import urlparse, parse_qs

class Handler(BaseHTTPRequestHandler):
    def _send(self, status, payload):
        data = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, format, *args):
        return

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/api/status':
            self._send(200, {
                'integrations': {'openweather': 'configured'},
                'runtime': {'model_artifact': {'state': 'configured'}}
            })
            return

        if parsed.path == '/api/locations/search':
            query = parse_qs(parsed.query).get('q', [''])[0]
            if not query:
                self._send(200, {'results': [], 'message': 'Enter a location query.'})
                return
            self._send(200, {
                'query': query,
                'results': [{
                    'display_name': 'Ankara, Turkiye',
                    'latitude': 39.9334,
                    'longitude': 32.8597,
                    'admin': {
                        'province': 'Ankara',
                        'district': 'Cankaya',
                        'country': 'Turkiye'
                    },
                    'source_label': 'mock-index'
                }],
                'message': None
            })
            return

        self._send(404, {'error': 'not found'})

    def do_POST(self):
        if self.path != '/api/assessments':
            self._send(404, {'error': 'not found'})
            return

        self._send(200, {
            'source_state': 'live',
            'location': {
                'name': 'Ankara, Turkiye',
                'latitude': 39.9334,
                'longitude': 32.8597,
                'source': 'mock-index'
            },
            'forecast_assessments': [
                {
                    'forecast_window': 'now',
                    'risk_level': 'high',
                    'risk_score': 0.74,
                    'model_confidence': 0.88,
                    'risk_trend': 'rising',
                    'priority_rank': 'P2',
                    'monitoring_radius': '20 km',
                    'recommended_action': 'prioritize local inspection',
                    'model_input_drivers': {
                        'temperature_c': 34,
                        'rain_mm': 0,
                        'wind_speed_mps': 8,
                        'cloud_cover_pct': 12
                    },
                    'weather_signals': {
                        'humidity_pct': 32,
                        'wind_gust_mps': 12,
                        'weather_description': 'sunny',
                        'visibility_m': 10000
                    },
                    'narrative_explanation': 'Grounded operational briefing for Ankara now window.',
                    'narrative_source_label': 'fallback'
                },
                {
                    'forecast_window': '24h',
                    'risk_level': 'medium',
                    'risk_score': 0.58,
                    'model_confidence': 0.81,
                    'risk_trend': 'stable',
                    'priority_rank': 'P3',
                    'monitoring_radius': '15 km',
                    'recommended_action': 'continue localized patrol checks',
                    'model_input_drivers': {
                        'temperature_c': 31,
                        'rain_mm': 0.5,
                        'wind_speed_mps': 6,
                        'cloud_cover_pct': 18
                    },
                    'weather_signals': {
                        'humidity_pct': 36,
                        'wind_gust_mps': 10,
                        'weather_description': 'clear',
                        'visibility_m': 9000
                    },
                    'narrative_explanation': 'Follow-up operational briefing for 24h window.',
                    'narrative_source_label': 'fallback'
                }
            ],
            'data_source_labels': {
                'assessment': 'live',
                'weather': 'live',
                'narrative': 'fallback'
            },
            'message': None
        })

if __name__ == '__main__':
    server = HTTPServer(('127.0.0.1', 8000), Handler)
    server.serve_forever()
