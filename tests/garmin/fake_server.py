"""Fixture locale uniquement. Le fournisseur Garmin est simulé ; API réelle."""
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location('bridge', Path(__file__).resolve().parents[2] / 'garmin-service/app.py')
service = importlib.util.module_from_spec(spec)
spec.loader.exec_module(service)
app = service.app


class FakeAccount:
    def __init__(self):
        self.calls = 0
        self.summary = None

    def upload_activity(self, filename):
        self.calls += 1
        self.summary = service.inspect_fit(Path(filename).read_bytes())
        if self.summary['total_distance'] == 9999:
            raise RuntimeError('Simulated upstream timeout, no real account')
        return {'detailedImportResult': {'successes': [{'internalId': 12345}]}}

    def get_activity(self, activity_id):
        summary = self.summary
        return {'activityId': 12345, 'distance': summary['total_distance'], 'duration': summary['total_timer_time'], 'calories': summary['total_calories'], 'startTimeGMT': summary['start_time'].isoformat(), 'activityType': {'typeKey': {'rowing': 'indoor_rowing', 'running': 'treadmill_running', 'fitness_equipment': 'elliptical'}[summary['sport']]}}


account = FakeAccount()
service.client = lambda: account


@app.get('/__test/count')
def count():
    return {'calls': account.calls}
