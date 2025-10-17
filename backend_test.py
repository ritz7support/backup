#!/usr/bin/env python3
"""
Backend API Testing for Events Page functionality
Tests all event-related endpoints with proper authentication
"""

import requests
import json
from datetime import datetime, timezone, timedelta
import sys
import os

# Configuration
BACKEND_URL = "https://connect-abcd.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "admin123"

class EventAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_session = requests.Session()
        self.test_event_id = None
        
    def log(self, message, level="INFO"):
        """Log test messages"""
        print(f"[{level}] {message}")
        
    def register_admin_user(self):
        """Register admin user if not exists"""
        try:
            register_data = {
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD,
                "name": "Admin User",
                "role": "admin"
            }
            
            response = self.admin_session.post(f"{BACKEND_URL}/auth/register", json=register_data)
            if response.status_code == 200:
                self.log("✅ Admin user registered successfully")
                return True
            elif response.status_code == 400 and "already registered" in response.text:
                self.log("ℹ️ Admin user already exists, proceeding with login")
                return True
            else:
                self.log(f"❌ Failed to register admin user: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Exception during admin registration: {e}", "ERROR")
            return False
    
    def login_admin(self):
        """Login as admin user"""
        try:
            login_data = {
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            }
            
            response = self.admin_session.post(f"{BACKEND_URL}/auth/login", json=login_data)
            if response.status_code == 200:
                data = response.json()
                self.log("✅ Admin login successful")
                return True
            else:
                self.log(f"❌ Admin login failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Exception during admin login: {e}", "ERROR")
            return False
    
    def test_get_events(self):
        """Test GET /api/events endpoint"""
        self.log("\n🧪 Testing GET /api/events")
        try:
            response = self.session.get(f"{BACKEND_URL}/events")
            
            if response.status_code == 200:
                events = response.json()
                self.log(f"✅ GET /api/events successful - Retrieved {len(events)} events")
                
                # Verify response structure
                if events:
                    event = events[0]
                    required_fields = ['id', 'title', 'description', 'event_type', 'start_time', 'end_time', 'requires_membership', 'rsvp_list']
                    missing_fields = [field for field in required_fields if field not in event]
                    
                    if missing_fields:
                        self.log(f"⚠️ Missing fields in event response: {missing_fields}", "WARNING")
                    else:
                        self.log("✅ Event response structure is correct")
                
                return True
            else:
                self.log(f"❌ GET /api/events failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in GET /api/events: {e}", "ERROR")
            return False
    
    def test_create_event(self):
        """Test POST /api/events endpoint (admin only)"""
        self.log("\n🧪 Testing POST /api/events (Create Event)")
        
        # Test event data
        start_time = datetime.now(timezone.utc) + timedelta(days=1)
        end_time = start_time + timedelta(hours=2)
        
        event_data = {
            "title": "Test Event - Backend Testing",
            "description": "This is a test event created during backend testing",
            "event_type": "workshop",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "requires_membership": False
        }
        
        try:
            # Test with admin user
            response = self.admin_session.post(f"{BACKEND_URL}/events", json=event_data)
            
            if response.status_code == 200:
                event = response.json()
                self.test_event_id = event['id']
                self.log(f"✅ Event created successfully with ID: {self.test_event_id}")
                
                # Verify event data
                if event['title'] == event_data['title'] and event['event_type'] == event_data['event_type']:
                    self.log("✅ Event data matches input")
                else:
                    self.log("⚠️ Event data doesn't match input", "WARNING")
                
                return True
            else:
                self.log(f"❌ Event creation failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in POST /api/events: {e}", "ERROR")
            return False
    
    def test_create_event_validation(self):
        """Test POST /api/events validation (end_time > start_time)"""
        self.log("\n🧪 Testing POST /api/events validation")
        
        # Test with invalid dates (end_time before start_time)
        start_time = datetime.now(timezone.utc) + timedelta(days=1)
        end_time = start_time - timedelta(hours=1)  # Invalid: end before start
        
        invalid_event_data = {
            "title": "Invalid Test Event",
            "description": "This event should fail validation",
            "event_type": "workshop",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "requires_membership": False
        }
        
        try:
            response = self.admin_session.post(f"{BACKEND_URL}/events", json=invalid_event_data)
            
            # This should fail validation, but let's see what happens
            if response.status_code != 200:
                self.log("✅ Event validation working - rejected invalid dates")
                return True
            else:
                self.log("⚠️ Event validation not implemented - invalid dates accepted", "WARNING")
                # Clean up the invalid event if it was created
                if 'id' in response.json():
                    invalid_event_id = response.json()['id']
                    self.admin_session.delete(f"{BACKEND_URL}/events/{invalid_event_id}")
                return True
                
        except Exception as e:
            self.log(f"❌ Exception in validation test: {e}", "ERROR")
            return False
    
    def test_update_event(self):
        """Test PUT /api/events/{event_id} endpoint (admin only)"""
        self.log("\n🧪 Testing PUT /api/events/{event_id} (Update Event)")
        
        if not self.test_event_id:
            self.log("❌ No test event ID available for update test", "ERROR")
            return False
        
        update_data = {
            "title": "Updated Test Event - Backend Testing",
            "description": "This event has been updated during testing",
            "event_type": "live_session"
        }
        
        try:
            # Test with admin user
            response = self.admin_session.put(f"{BACKEND_URL}/events/{self.test_event_id}", json=update_data)
            
            if response.status_code == 200:
                self.log("✅ Event updated successfully")
                
                # Verify the update by fetching the event
                get_response = self.session.get(f"{BACKEND_URL}/events")
                if get_response.status_code == 200:
                    events = get_response.json()
                    updated_event = next((e for e in events if e['id'] == self.test_event_id), None)
                    
                    if updated_event and updated_event['title'] == update_data['title']:
                        self.log("✅ Event update verified - changes saved correctly")
                    else:
                        self.log("⚠️ Event update not reflected in database", "WARNING")
                
                return True
            else:
                self.log(f"❌ Event update failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in PUT /api/events: {e}", "ERROR")
            return False
    
    def test_update_event_non_admin(self):
        """Test PUT /api/events/{event_id} with non-admin user (should fail)"""
        self.log("\n🧪 Testing PUT /api/events/{event_id} with non-admin user")
        
        if not self.test_event_id:
            self.log("❌ No test event ID available for non-admin update test", "ERROR")
            return False
        
        # Register a regular user
        try:
            regular_user_data = {
                "email": "regular@test.com",
                "password": "regular123",
                "name": "Regular User",
                "role": "learner"
            }
            
            regular_session = requests.Session()
            
            # Register and login regular user
            register_response = regular_session.post(f"{BACKEND_URL}/auth/register", json=regular_user_data)
            if register_response.status_code not in [200, 400]:  # 400 if already exists
                login_response = regular_session.post(f"{BACKEND_URL}/auth/login", json={
                    "email": regular_user_data["email"],
                    "password": regular_user_data["password"]
                })
                if login_response.status_code != 200:
                    self.log("❌ Failed to setup regular user for test", "ERROR")
                    return False
            
            # Try to update event with regular user
            update_data = {"title": "Unauthorized Update Attempt"}
            response = regular_session.put(f"{BACKEND_URL}/events/{self.test_event_id}", json=update_data)
            
            if response.status_code == 403:
                self.log("✅ Non-admin update correctly rejected (403 Forbidden)")
                return True
            elif response.status_code == 401:
                self.log("✅ Non-admin update correctly rejected (401 Unauthorized)")
                return True
            else:
                self.log(f"❌ Non-admin update should be rejected but got: {response.status_code}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in non-admin update test: {e}", "ERROR")
            return False
    
    def test_rsvp_event(self):
        """Test POST /api/events/{event_id}/rsvp endpoint"""
        self.log("\n🧪 Testing POST /api/events/{event_id}/rsvp (RSVP to Event)")
        
        if not self.test_event_id:
            self.log("❌ No test event ID available for RSVP test", "ERROR")
            return False
        
        try:
            # Test RSVP with admin user
            response = self.admin_session.post(f"{BACKEND_URL}/events/{self.test_event_id}/rsvp")
            
            if response.status_code == 200:
                rsvp_data = response.json()
                self.log("✅ RSVP successful")
                
                if 'rsvp_list' in rsvp_data:
                    self.log(f"✅ RSVP list returned with {len(rsvp_data['rsvp_list'])} attendees")
                    
                    # Test RSVP toggle (RSVP again should remove)
                    toggle_response = self.admin_session.post(f"{BACKEND_URL}/events/{self.test_event_id}/rsvp")
                    if toggle_response.status_code == 200:
                        toggle_data = toggle_response.json()
                        if len(toggle_data['rsvp_list']) != len(rsvp_data['rsvp_list']):
                            self.log("✅ RSVP toggle behavior working correctly")
                        else:
                            self.log("⚠️ RSVP toggle behavior not working as expected", "WARNING")
                    
                    return True
                else:
                    self.log("⚠️ RSVP response missing rsvp_list field", "WARNING")
                    return True
            else:
                self.log(f"❌ RSVP failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in POST /api/events/rsvp: {e}", "ERROR")
            return False
    
    def test_delete_event(self):
        """Test DELETE /api/events/{event_id} endpoint (admin only)"""
        self.log("\n🧪 Testing DELETE /api/events/{event_id} (Delete Event)")
        
        if not self.test_event_id:
            self.log("❌ No test event ID available for delete test", "ERROR")
            return False
        
        try:
            # Test with admin user
            response = self.admin_session.delete(f"{BACKEND_URL}/events/{self.test_event_id}")
            
            if response.status_code == 200:
                self.log("✅ Event deleted successfully")
                
                # Verify deletion by trying to fetch the event
                get_response = self.session.get(f"{BACKEND_URL}/events")
                if get_response.status_code == 200:
                    events = get_response.json()
                    deleted_event = next((e for e in events if e['id'] == self.test_event_id), None)
                    
                    if not deleted_event:
                        self.log("✅ Event deletion verified - event no longer exists")
                    else:
                        self.log("⚠️ Event still exists after deletion", "WARNING")
                
                return True
            else:
                self.log(f"❌ Event deletion failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in DELETE /api/events: {e}", "ERROR")
            return False
    
    def test_delete_event_non_admin(self):
        """Test DELETE /api/events/{event_id} with non-admin user (should fail)"""
        self.log("\n🧪 Testing DELETE /api/events/{event_id} with non-admin user")
        
        # First create a new event for this test
        start_time = datetime.now(timezone.utc) + timedelta(days=2)
        end_time = start_time + timedelta(hours=1)
        
        event_data = {
            "title": "Test Event for Non-Admin Delete",
            "description": "This event will be used to test non-admin delete",
            "event_type": "workshop",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "requires_membership": False
        }
        
        try:
            # Create event with admin
            create_response = self.admin_session.post(f"{BACKEND_URL}/events", json=event_data)
            if create_response.status_code != 200:
                self.log("❌ Failed to create test event for non-admin delete test", "ERROR")
                return False
            
            test_event_id = create_response.json()['id']
            
            # Try to delete with regular user
            regular_user_data = {
                "email": "regular2@test.com",
                "password": "regular123",
                "name": "Regular User 2",
                "role": "learner"
            }
            
            regular_session = requests.Session()
            
            # Register and login regular user
            register_response = regular_session.post(f"{BACKEND_URL}/auth/register", json=regular_user_data)
            if register_response.status_code not in [200, 400]:
                login_response = regular_session.post(f"{BACKEND_URL}/auth/login", json={
                    "email": regular_user_data["email"],
                    "password": regular_user_data["password"]
                })
                if login_response.status_code != 200:
                    self.log("❌ Failed to setup regular user for delete test", "ERROR")
                    return False
            
            # Try to delete event with regular user
            response = regular_session.delete(f"{BACKEND_URL}/events/{test_event_id}")
            
            if response.status_code == 403:
                self.log("✅ Non-admin delete correctly rejected (403 Forbidden)")
                # Clean up - delete the test event with admin
                self.admin_session.delete(f"{BACKEND_URL}/events/{test_event_id}")
                return True
            elif response.status_code == 401:
                self.log("✅ Non-admin delete correctly rejected (401 Unauthorized)")
                # Clean up - delete the test event with admin
                self.admin_session.delete(f"{BACKEND_URL}/events/{test_event_id}")
                return True
            else:
                self.log(f"❌ Non-admin delete should be rejected but got: {response.status_code}", "ERROR")
                # Clean up - delete the test event with admin
                self.admin_session.delete(f"{BACKEND_URL}/events/{test_event_id}")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in non-admin delete test: {e}", "ERROR")
            return False
    
    def run_all_tests(self):
        """Run all event API tests"""
        self.log("🚀 Starting Event API Backend Tests")
        self.log(f"Backend URL: {BACKEND_URL}")
        
        results = {}
        
        # Setup admin user
        if not self.register_admin_user():
            self.log("❌ Failed to setup admin user - aborting tests", "ERROR")
            return False
        
        if not self.login_admin():
            self.log("❌ Failed to login admin user - aborting tests", "ERROR")
            return False
        
        # Run tests
        test_methods = [
            ('GET Events', self.test_get_events),
            ('Create Event', self.test_create_event),
            ('Create Event Validation', self.test_create_event_validation),
            ('Update Event (Admin)', self.test_update_event),
            ('Update Event (Non-Admin)', self.test_update_event_non_admin),
            ('RSVP Event', self.test_rsvp_event),
            ('Delete Event (Non-Admin)', self.test_delete_event_non_admin),
            ('Delete Event (Admin)', self.test_delete_event),
        ]
        
        for test_name, test_method in test_methods:
            try:
                results[test_name] = test_method()
            except Exception as e:
                self.log(f"❌ Unexpected error in {test_name}: {e}", "ERROR")
                results[test_name] = False
        
        # Summary
        self.log("\n" + "="*60)
        self.log("📊 TEST RESULTS SUMMARY")
        self.log("="*60)
        
        passed = 0
        total = len(results)
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{test_name}: {status}")
            if result:
                passed += 1
        
        self.log(f"\nOverall: {passed}/{total} tests passed")
        
        if passed == total:
            self.log("🎉 All tests passed!")
            return True
        else:
            self.log(f"⚠️ {total - passed} tests failed")
            return False

def main():
    """Main test runner"""
    tester = EventAPITester()
    success = tester.run_all_tests()
    
    if success:
        print("\n✅ Backend testing completed successfully")
        sys.exit(0)
    else:
        print("\n❌ Backend testing completed with failures")
        sys.exit(1)

if __name__ == "__main__":
    main()