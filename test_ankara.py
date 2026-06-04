import urllib.request
import json

req = urllib.request.Request(
    "http://localhost:8000/api/assessments",
    data=json.dumps({
        "location": {"name": "Ankara", "latitude": 39.9334, "longitude": 32.8597, "source": "search"},
        "forecast_windows": ["now", "24h", "48h", "72h"]
    }).encode('utf-8'),
    headers={"Content-Type": "application/json"}
)

with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode('utf-8'))
    print("Source State:", data.get("source_state"))
    print("Data Source Labels:", data.get("data_source_labels"))
    for a in data.get("forecast_assessments", []):
        print(f"{a['forecast_window']}: {a['risk_level']} (Score: {a['risk_score']}, Trend: {a['risk_trend']}, Priority: {a['priority_rank']}, Alert: {a['risk_alert_status']})")
