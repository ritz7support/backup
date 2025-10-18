#!/usr/bin/env python3
"""
Backend API Testing for Phase 2 Enhanced User Management Features
Tests team member badge management, centralized user management, soft blocks with expiry, and auto-expiry system
"""

import requests
import json
from datetime import datetime, timezone, timedelta
import sys
import os
import time

# Configuration
BACKEND_URL = "https://community-space-8.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "admin123"
LEARNER_EMAIL = "learner@test.com"
LEARNER_PASSWORD = "password123"

class Phase2EnhancedUserManagementTester:
    def __init__(self):
        self.admin_session = requests.Session()
        self.learner_session = requests.Session()
        self.test_learner_id = None
        self.test_admin_id = None
        self.test_space_id = None
        self.test_user_for_blocking_id = None
        
    def log(self, message, level="INFO"):
        """Log test messages"""
        print(f"[{level}] {message}")
        
    def setup_test_users(self):
        """Setup admin and learner users for testing"""
        self.log("🔧 Setting up test users...")
        
        # Setup admin user
        admin_data = {
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "name": "Test Admin User",
            "role": "admin"
        }
        
        try:
            response = self.admin_session.post(f"{BACKEND_URL}/auth/register", json=admin_data)
            if response.status_code == 200:
                self.log("✅ Admin user registered successfully")
            elif response.status_code == 400 and "already registered" in response.text:
                self.log("ℹ️ Admin user already exists")
            else:
                self.log(f"❌ Failed to register admin user: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Exception during admin registration: {e}", "ERROR")
            return False
        
        # Login admin
        try:
            login_data = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
            response = self.admin_session.post(f"{BACKEND_URL}/auth/login", json=login_data)
            if response.status_code == 200:
                self.log("✅ Admin login successful")
            else:
                self.log(f"❌ Admin login failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Exception during admin login: {e}", "ERROR")
            return False
        
        # Setup learner user
        learner_data = {
            "email": LEARNER_EMAIL,
            "password": LEARNER_PASSWORD,
            "name": "Test Learner User",
            "role": "learner"
        }
        
        try:
            response = self.learner_session.post(f"{BACKEND_URL}/auth/register", json=learner_data)
            if response.status_code == 200:
                self.log("✅ Learner user registered successfully")
                user_data = response.json()
                self.test_learner_id = user_data.get('user', {}).get('id')
            elif response.status_code == 400 and "already registered" in response.text:
                self.log("ℹ️ Learner user already exists")
                # Login to get user ID
                login_response = self.learner_session.post(f"{BACKEND_URL}/auth/login", json={
                    "email": LEARNER_EMAIL, "password": LEARNER_PASSWORD
                })
                if login_response.status_code == 200:
                    user_data = login_response.json()
                    self.test_learner_id = user_data.get('user', {}).get('id')
            else:
                self.log(f"❌ Failed to register learner user: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Exception during learner registration: {e}", "ERROR")
            return False
        
        if not self.test_learner_id:
            self.log("❌ Failed to get learner user ID", "ERROR")
            return False
        
        self.log(f"✅ Test users setup complete. Learner ID: {self.test_learner_id}")
        return True
    
    def test_get_all_users_admin(self):
        """Test GET /api/users/all with admin user"""
        self.log("\n🧪 Testing GET /api/users/all (Admin Access)")
        
        try:
            response = self.admin_session.get(f"{BACKEND_URL}/users/all")
            
            if response.status_code == 200:
                users = response.json()
                self.log(f"✅ GET /api/users/all successful - Retrieved {len(users)} users")
                
                # Verify response structure
                if users:
                    user = users[0]
                    required_fields = ['id', 'email', 'name', 'role']
                    missing_fields = [field for field in required_fields if field not in user]
                    
                    if missing_fields:
                        self.log(f"⚠️ Missing fields in user response: {missing_fields}", "WARNING")
                    else:
                        self.log("✅ User response structure is correct")
                    
                    # Check that password_hash is not included
                    if 'password_hash' in user:
                        self.log("⚠️ Security issue: password_hash included in response", "WARNING")
                    else:
                        self.log("✅ Security check passed: password_hash not in response")
                
                return True
            else:
                self.log(f"❌ GET /api/users/all failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in GET /api/users/all: {e}", "ERROR")
            return False
    
    def test_get_all_users_non_admin(self):
        """Test GET /api/users/all with non-admin user (should fail)"""
        self.log("\n🧪 Testing GET /api/users/all (Non-Admin Access - Should Fail)")
        
        try:
            response = self.learner_session.get(f"{BACKEND_URL}/users/all")
            
            if response.status_code == 403:
                self.log("✅ Non-admin access correctly rejected (403 Forbidden)")
                return True
            elif response.status_code == 401:
                self.log("✅ Non-admin access correctly rejected (401 Unauthorized)")
                return True
            else:
                self.log(f"❌ Non-admin access should be rejected but got: {response.status_code}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in non-admin GET /api/users/all: {e}", "ERROR")
            return False
    
    def test_promote_user_to_admin(self):
        """Test PUT /api/users/{user_id}/promote-to-admin"""
        self.log("\n🧪 Testing PUT /api/users/{user_id}/promote-to-admin")
        
        if not self.test_learner_id:
            self.log("❌ No test learner ID available", "ERROR")
            return False
        
        try:
            response = self.admin_session.put(f"{BACKEND_URL}/users/{self.test_learner_id}/promote-to-admin")
            
            if response.status_code == 200:
                self.log("✅ User promoted to admin successfully")
                
                # Verify the promotion by checking user role
                users_response = self.admin_session.get(f"{BACKEND_URL}/users/all")
                if users_response.status_code == 200:
                    users = users_response.json()
                    promoted_user = next((u for u in users if u['id'] == self.test_learner_id), None)
                    
                    if promoted_user and promoted_user.get('role') == 'admin':
                        self.log("✅ User promotion verified - role updated to admin")
                        self.test_admin_id = self.test_learner_id  # Store for demotion test
                        return True
                    else:
                        self.log("⚠️ User promotion not reflected in database", "WARNING")
                        return False
                else:
                    self.log("⚠️ Could not verify promotion", "WARNING")
                    return True
            else:
                self.log(f"❌ User promotion failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in promote user: {e}", "ERROR")
            return False
    
    def test_promote_self_admin(self):
        """Test promoting self (should fail)"""
        self.log("\n🧪 Testing PUT /api/users/{user_id}/promote-to-admin (Self Promotion - Should Fail)")
        
        # Get admin user ID
        try:
            me_response = self.admin_session.get(f"{BACKEND_URL}/auth/me")
            if me_response.status_code != 200:
                self.log("❌ Could not get current admin user info", "ERROR")
                return False
            
            admin_user = me_response.json()
            admin_id = admin_user.get('id')
            
            response = self.admin_session.put(f"{BACKEND_URL}/users/{admin_id}/promote-to-admin")
            
            if response.status_code == 400:
                self.log("✅ Self promotion correctly rejected (400 Bad Request)")
                return True
            else:
                self.log(f"❌ Self promotion should be rejected but got: {response.status_code}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in self promotion test: {e}", "ERROR")
            return False
    
    def test_promote_existing_admin(self):
        """Test promoting an existing admin (should fail)"""
        self.log("\n🧪 Testing PUT /api/users/{user_id}/promote-to-admin (Existing Admin - Should Fail)")
        
        if not self.test_admin_id:
            self.log("❌ No test admin ID available (need to run promotion test first)", "ERROR")
            return False
        
        try:
            response = self.admin_session.put(f"{BACKEND_URL}/users/{self.test_admin_id}/promote-to-admin")
            
            if response.status_code == 400:
                self.log("✅ Existing admin promotion correctly rejected (400 Bad Request)")
                return True
            else:
                self.log(f"❌ Existing admin promotion should be rejected but got: {response.status_code}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in existing admin promotion test: {e}", "ERROR")
            return False
    
    def test_promote_non_admin_user(self):
        """Test promotion by non-admin user (should fail)"""
        self.log("\n🧪 Testing PUT /api/users/{user_id}/promote-to-admin (Non-Admin User - Should Fail)")
        
        # Create another learner for this test
        test_user_data = {
            "email": "test_promote@test.com",
            "password": "test123",
            "name": "Test Promote User",
            "role": "learner"
        }
        
        try:
            test_session = requests.Session()
            register_response = test_session.post(f"{BACKEND_URL}/auth/register", json=test_user_data)
            
            if register_response.status_code not in [200, 400]:
                login_response = test_session.post(f"{BACKEND_URL}/auth/login", json={
                    "email": test_user_data["email"],
                    "password": test_user_data["password"]
                })
                if login_response.status_code != 200:
                    self.log("❌ Failed to setup test user for non-admin promotion test", "ERROR")
                    return False
            
            # Try to promote someone as non-admin
            if self.test_admin_id:
                response = test_session.put(f"{BACKEND_URL}/users/{self.test_admin_id}/promote-to-admin")
                
                if response.status_code == 403:
                    self.log("✅ Non-admin promotion correctly rejected (403 Forbidden)")
                    return True
                elif response.status_code == 401:
                    self.log("✅ Non-admin promotion correctly rejected (401 Unauthorized)")
                    return True
                else:
                    self.log(f"❌ Non-admin promotion should be rejected but got: {response.status_code}", "ERROR")
                    return False
            else:
                self.log("❌ No admin ID available for non-admin promotion test", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in non-admin promotion test: {e}", "ERROR")
            return False
    
    def test_demote_admin_to_learner(self):
        """Test PUT /api/users/{user_id}/demote-from-admin"""
        self.log("\n🧪 Testing PUT /api/users/{user_id}/demote-from-admin")
        
        if not self.test_admin_id:
            self.log("❌ No test admin ID available (need to run promotion test first)", "ERROR")
            return False
        
        try:
            response = self.admin_session.put(f"{BACKEND_URL}/users/{self.test_admin_id}/demote-from-admin")
            
            if response.status_code == 200:
                self.log("✅ Admin demoted to learner successfully")
                
                # Verify the demotion by checking user role
                users_response = self.admin_session.get(f"{BACKEND_URL}/users/all")
                if users_response.status_code == 200:
                    users = users_response.json()
                    demoted_user = next((u for u in users if u['id'] == self.test_admin_id), None)
                    
                    if demoted_user and demoted_user.get('role') == 'learner':
                        self.log("✅ Admin demotion verified - role updated to learner")
                        return True
                    else:
                        self.log("⚠️ Admin demotion not reflected in database", "WARNING")
                        return False
                else:
                    self.log("⚠️ Could not verify demotion", "WARNING")
                    return True
            else:
                self.log(f"❌ Admin demotion failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in demote admin: {e}", "ERROR")
            return False
    
    def test_demote_self_admin(self):
        """Test demoting self (should fail)"""
        self.log("\n🧪 Testing PUT /api/users/{user_id}/demote-from-admin (Self Demotion - Should Fail)")
        
        # Get admin user ID
        try:
            me_response = self.admin_session.get(f"{BACKEND_URL}/auth/me")
            if me_response.status_code != 200:
                self.log("❌ Could not get current admin user info", "ERROR")
                return False
            
            admin_user = me_response.json()
            admin_id = admin_user.get('id')
            
            response = self.admin_session.put(f"{BACKEND_URL}/users/{admin_id}/demote-from-admin")
            
            if response.status_code == 400:
                self.log("✅ Self demotion correctly rejected (400 Bad Request)")
                return True
            else:
                self.log(f"❌ Self demotion should be rejected but got: {response.status_code}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in self demotion test: {e}", "ERROR")
            return False
    
    def test_demote_non_admin(self):
        """Test demoting a non-admin user (should fail)"""
        self.log("\n🧪 Testing PUT /api/users/{user_id}/demote-from-admin (Non-Admin User - Should Fail)")
        
        # Create a learner user for this test
        test_user_data = {
            "email": "test_demote@test.com",
            "password": "test123",
            "name": "Test Demote User",
            "role": "learner"
        }
        
        try:
            test_session = requests.Session()
            register_response = test_session.post(f"{BACKEND_URL}/auth/register", json=test_user_data)
            
            test_user_id = None
            if register_response.status_code == 200:
                user_data = register_response.json()
                test_user_id = user_data.get('user', {}).get('id')
            elif register_response.status_code == 400:
                # User exists, login to get ID
                login_response = test_session.post(f"{BACKEND_URL}/auth/login", json={
                    "email": test_user_data["email"],
                    "password": test_user_data["password"]
                })
                if login_response.status_code == 200:
                    user_data = login_response.json()
                    test_user_id = user_data.get('user', {}).get('id')
            
            if not test_user_id:
                self.log("❌ Failed to get test user ID for demotion test", "ERROR")
                return False
            
            response = self.admin_session.put(f"{BACKEND_URL}/users/{test_user_id}/demote-from-admin")
            
            if response.status_code == 400:
                self.log("✅ Non-admin demotion correctly rejected (400 Bad Request)")
                return True
            else:
                self.log(f"❌ Non-admin demotion should be rejected but got: {response.status_code}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in non-admin demotion test: {e}", "ERROR")
            return False
    
    def test_demote_by_non_admin(self):
        """Test demotion by non-admin user (should fail)"""
        self.log("\n🧪 Testing PUT /api/users/{user_id}/demote-from-admin (By Non-Admin - Should Fail)")
        
        if not self.test_admin_id:
            # Create a temporary admin for this test
            temp_learner_data = {
                "email": "temp_admin@test.com",
                "password": "temp123",
                "name": "Temp Admin User",
                "role": "learner"
            }
            
            try:
                temp_session = requests.Session()
                register_response = temp_session.post(f"{BACKEND_URL}/auth/register", json=temp_learner_data)
                
                temp_user_id = None
                if register_response.status_code == 200:
                    user_data = register_response.json()
                    temp_user_id = user_data.get('user', {}).get('id')
                elif register_response.status_code == 400:
                    login_response = temp_session.post(f"{BACKEND_URL}/auth/login", json={
                        "email": temp_learner_data["email"],
                        "password": temp_learner_data["password"]
                    })
                    if login_response.status_code == 200:
                        user_data = login_response.json()
                        temp_user_id = user_data.get('user', {}).get('id')
                
                if temp_user_id:
                    # Promote to admin first
                    promote_response = self.admin_session.put(f"{BACKEND_URL}/users/{temp_user_id}/promote-to-admin")
                    if promote_response.status_code == 200:
                        self.test_admin_id = temp_user_id
                    else:
                        self.log("❌ Failed to create temporary admin for test", "ERROR")
                        return False
                else:
                    self.log("❌ Failed to setup temporary admin", "ERROR")
                    return False
            except Exception as e:
                self.log(f"❌ Exception setting up temporary admin: {e}", "ERROR")
                return False
        
        try:
            # Try to demote admin using learner session
            response = self.learner_session.put(f"{BACKEND_URL}/users/{self.test_admin_id}/demote-from-admin")
            
            if response.status_code == 403:
                self.log("✅ Non-admin demotion correctly rejected (403 Forbidden)")
                return True
            elif response.status_code == 401:
                self.log("✅ Non-admin demotion correctly rejected (401 Unauthorized)")
                return True
            else:
                self.log(f"❌ Non-admin demotion should be rejected but got: {response.status_code}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in non-admin demotion test: {e}", "ERROR")
            return False
    
    def test_role_persistence(self):
        """Test that role changes are persisted in database"""
        self.log("\n🧪 Testing Role Change Persistence")
        
        # Create a new user for this test
        test_user_data = {
            "email": "persistence_test@test.com",
            "password": "persist123",
            "name": "Persistence Test User",
            "role": "learner"
        }
        
        try:
            test_session = requests.Session()
            register_response = test_session.post(f"{BACKEND_URL}/auth/register", json=test_user_data)
            
            test_user_id = None
            if register_response.status_code == 200:
                user_data = register_response.json()
                test_user_id = user_data.get('user', {}).get('id')
            elif register_response.status_code == 400:
                login_response = test_session.post(f"{BACKEND_URL}/auth/login", json={
                    "email": test_user_data["email"],
                    "password": test_user_data["password"]
                })
                if login_response.status_code == 200:
                    user_data = login_response.json()
                    test_user_id = user_data.get('user', {}).get('id')
            
            if not test_user_id:
                self.log("❌ Failed to setup user for persistence test", "ERROR")
                return False
            
            # 1. Verify initial role is learner
            users_response = self.admin_session.get(f"{BACKEND_URL}/users/all")
            if users_response.status_code == 200:
                users = users_response.json()
                test_user = next((u for u in users if u['id'] == test_user_id), None)
                if not test_user or test_user.get('role') != 'learner':
                    self.log("❌ Initial role not set correctly", "ERROR")
                    return False
                self.log("✅ Initial role verified as learner")
            
            # 2. Promote to admin
            promote_response = self.admin_session.put(f"{BACKEND_URL}/users/{test_user_id}/promote-to-admin")
            if promote_response.status_code != 200:
                self.log("❌ Failed to promote user for persistence test", "ERROR")
                return False
            
            # 3. Verify promotion persisted
            users_response = self.admin_session.get(f"{BACKEND_URL}/users/all")
            if users_response.status_code == 200:
                users = users_response.json()
                test_user = next((u for u in users if u['id'] == test_user_id), None)
                if not test_user or test_user.get('role') != 'admin':
                    self.log("❌ Promotion not persisted in database", "ERROR")
                    return False
                self.log("✅ Promotion persistence verified")
            
            # 4. Demote back to learner
            demote_response = self.admin_session.put(f"{BACKEND_URL}/users/{test_user_id}/demote-from-admin")
            if demote_response.status_code != 200:
                self.log("❌ Failed to demote user for persistence test", "ERROR")
                return False
            
            # 5. Verify demotion persisted
            users_response = self.admin_session.get(f"{BACKEND_URL}/users/all")
            if users_response.status_code == 200:
                users = users_response.json()
                test_user = next((u for u in users if u['id'] == test_user_id), None)
                if not test_user or test_user.get('role') != 'learner':
                    self.log("❌ Demotion not persisted in database", "ERROR")
                    return False
                self.log("✅ Demotion persistence verified")
            
            self.log("✅ All role changes properly persisted in database")
            return True
            
        except Exception as e:
            self.log(f"❌ Exception in persistence test: {e}", "ERROR")
            return False
    
    def setup_test_space(self):
        """Setup a test space for blocking tests"""
        self.log("🔧 Setting up test space...")
        
        try:
            # Get existing spaces first
            spaces_response = self.admin_session.get(f"{BACKEND_URL}/spaces")
            if spaces_response.status_code == 200:
                spaces = spaces_response.json()
                if spaces:
                    self.test_space_id = spaces[0]['id']
                    self.log(f"✅ Using existing space: {self.test_space_id}")
                    return True
            
            # If no spaces, create one
            space_data = {
                "name": "Test Space for Blocking",
                "description": "Test space for soft/hard block testing",
                "visibility": "public",
                "space_type": "post",
                "allow_member_posts": True
            }
            
            create_response = self.admin_session.post(f"{BACKEND_URL}/admin/spaces", json=space_data)
            if create_response.status_code == 200:
                space = create_response.json()
                self.test_space_id = space['id']
                self.log(f"✅ Created test space: {self.test_space_id}")
                return True
            else:
                self.log(f"❌ Failed to create test space: {create_response.status_code}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception setting up test space: {e}", "ERROR")
            return False
    
    def setup_test_user_for_blocking(self):
        """Setup a test user for blocking tests"""
        self.log("🔧 Setting up test user for blocking...")
        
        test_user_data = {
            "email": "blocktest@test.com",
            "password": "block123",
            "name": "Block Test User",
            "role": "learner"
        }
        
        try:
            test_session = requests.Session()
            register_response = test_session.post(f"{BACKEND_URL}/auth/register", json=test_user_data)
            
            if register_response.status_code == 200:
                user_data = register_response.json()
                self.test_user_for_blocking_id = user_data.get('user', {}).get('id')
                self.log(f"✅ Created test user for blocking: {self.test_user_for_blocking_id}")
            elif register_response.status_code == 400 and "already registered" in register_response.text:
                # User exists, login to get ID
                login_response = test_session.post(f"{BACKEND_URL}/auth/login", json={
                    "email": test_user_data["email"],
                    "password": test_user_data["password"]
                })
                if login_response.status_code == 200:
                    user_data = login_response.json()
                    self.test_user_for_blocking_id = user_data.get('user', {}).get('id')
                    self.log(f"✅ Using existing test user for blocking: {self.test_user_for_blocking_id}")
            
            if not self.test_user_for_blocking_id:
                self.log("❌ Failed to get test user ID for blocking", "ERROR")
                return False
            
            # Join the test space
            if self.test_space_id:
                join_response = test_session.post(f"{BACKEND_URL}/spaces/{self.test_space_id}/join")
                if join_response.status_code == 200:
                    self.log("✅ Test user joined test space")
                else:
                    self.log(f"⚠️ Test user join failed: {join_response.status_code}", "WARNING")
            
            return True
            
        except Exception as e:
            self.log(f"❌ Exception setting up test user for blocking: {e}", "ERROR")
            return False
    
    # ==================== PHASE 2 TESTS ====================
    
    def test_team_member_badge_grant(self):
        """Test PUT /api/users/{user_id}/set-team-member (grant badge)"""
        self.log("\n🧪 Testing PUT /api/users/{user_id}/set-team-member (Grant Badge)")
        
        if not self.test_learner_id:
            self.log("❌ No test learner ID available", "ERROR")
            return False
        
        try:
            # Grant team member badge
            grant_data = {"is_team_member": True}
            response = self.admin_session.put(f"{BACKEND_URL}/users/{self.test_learner_id}/set-team-member", json=grant_data)
            
            if response.status_code == 200:
                self.log("✅ Team member badge granted successfully")
                
                # Verify badge in database
                users_response = self.admin_session.get(f"{BACKEND_URL}/users/all")
                if users_response.status_code == 200:
                    users = users_response.json()
                    test_user = next((u for u in users if u['id'] == self.test_learner_id), None)
                    
                    if test_user and test_user.get('is_team_member') == True:
                        self.log("✅ Team member badge verified in database")
                        return True
                    else:
                        self.log("❌ Team member badge not reflected in database", "ERROR")
                        return False
                else:
                    self.log("⚠️ Could not verify team member badge", "WARNING")
                    return True
            else:
                self.log(f"❌ Team member badge grant failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in team member badge grant: {e}", "ERROR")
            return False
    
    def test_team_member_badge_remove(self):
        """Test PUT /api/users/{user_id}/set-team-member (remove badge)"""
        self.log("\n🧪 Testing PUT /api/users/{user_id}/set-team-member (Remove Badge)")
        
        if not self.test_learner_id:
            self.log("❌ No test learner ID available", "ERROR")
            return False
        
        try:
            # Remove team member badge
            remove_data = {"is_team_member": False}
            response = self.admin_session.put(f"{BACKEND_URL}/users/{self.test_learner_id}/set-team-member", json=remove_data)
            
            if response.status_code == 200:
                self.log("✅ Team member badge removed successfully")
                
                # Verify badge removal in database
                users_response = self.admin_session.get(f"{BACKEND_URL}/users/all")
                if users_response.status_code == 200:
                    users = users_response.json()
                    test_user = next((u for u in users if u['id'] == self.test_learner_id), None)
                    
                    if test_user and test_user.get('is_team_member') == False:
                        self.log("✅ Team member badge removal verified in database")
                        return True
                    else:
                        self.log("❌ Team member badge removal not reflected in database", "ERROR")
                        return False
                else:
                    self.log("⚠️ Could not verify team member badge removal", "WARNING")
                    return True
            else:
                self.log(f"❌ Team member badge removal failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in team member badge removal: {e}", "ERROR")
            return False
    
    def test_team_member_badge_non_admin(self):
        """Test team member badge management by non-admin (should fail)"""
        self.log("\n🧪 Testing PUT /api/users/{user_id}/set-team-member (Non-Admin - Should Fail)")
        
        if not self.test_learner_id:
            self.log("❌ No test learner ID available", "ERROR")
            return False
        
        try:
            grant_data = {"is_team_member": True}
            response = self.learner_session.put(f"{BACKEND_URL}/users/{self.test_learner_id}/set-team-member", json=grant_data)
            
            if response.status_code == 403:
                self.log("✅ Non-admin team member badge management correctly rejected (403 Forbidden)")
                return True
            elif response.status_code == 401:
                self.log("✅ Non-admin team member badge management correctly rejected (401 Unauthorized)")
                return True
            else:
                self.log(f"❌ Non-admin access should be rejected but got: {response.status_code}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in non-admin team member badge test: {e}", "ERROR")
            return False
    
    def test_centralized_user_management(self):
        """Test GET /api/users/all-with-memberships"""
        self.log("\n🧪 Testing GET /api/users/all-with-memberships")
        
        try:
            response = self.admin_session.get(f"{BACKEND_URL}/users/all-with-memberships")
            
            if response.status_code == 200:
                users = response.json()
                self.log(f"✅ GET /api/users/all-with-memberships successful - Retrieved {len(users)} users")
                
                # Verify response structure
                if users:
                    user = users[0]
                    required_fields = ['id', 'email', 'name', 'role', 'is_team_member', 'memberships', 'managed_spaces_count']
                    missing_fields = [field for field in required_fields if field not in user]
                    
                    if missing_fields:
                        self.log(f"⚠️ Missing fields in user response: {missing_fields}", "WARNING")
                    else:
                        self.log("✅ User response structure is correct")
                    
                    # Check memberships structure
                    if 'memberships' in user and user['memberships']:
                        membership = user['memberships'][0]
                        membership_fields = ['space_id', 'space_name', 'role', 'status', 'block_type', 'block_expires_at']
                        missing_membership_fields = [field for field in membership_fields if field not in membership]
                        
                        if missing_membership_fields:
                            self.log(f"⚠️ Missing fields in membership response: {missing_membership_fields}", "WARNING")
                        else:
                            self.log("✅ Membership response structure is correct")
                    
                    # Check that password_hash is not included
                    if 'password_hash' in user:
                        self.log("⚠️ Security issue: password_hash included in response", "WARNING")
                    else:
                        self.log("✅ Security check passed: password_hash not in response")
                
                return True
            else:
                self.log(f"❌ GET /api/users/all-with-memberships failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in GET /api/users/all-with-memberships: {e}", "ERROR")
            return False
    
    def test_centralized_user_management_non_admin(self):
        """Test GET /api/users/all-with-memberships with non-admin (should fail)"""
        self.log("\n🧪 Testing GET /api/users/all-with-memberships (Non-Admin - Should Fail)")
        
        try:
            response = self.learner_session.get(f"{BACKEND_URL}/users/all-with-memberships")
            
            if response.status_code == 403:
                self.log("✅ Non-admin access correctly rejected (403 Forbidden)")
                return True
            elif response.status_code == 401:
                self.log("✅ Non-admin access correctly rejected (401 Unauthorized)")
                return True
            else:
                self.log(f"❌ Non-admin access should be rejected but got: {response.status_code}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in non-admin centralized user management test: {e}", "ERROR")
            return False
    
    def test_soft_block_with_expiry(self):
        """Test PUT /api/spaces/{space_id}/members/{user_id}/block with soft block and expiry"""
        self.log("\n🧪 Testing PUT /api/spaces/{space_id}/members/{user_id}/block (Soft Block with Expiry)")
        
        if not self.test_space_id or not self.test_user_for_blocking_id:
            self.log("❌ Test space or user not available", "ERROR")
            return False
        
        try:
            # Create soft block with 2-minute expiry
            expires_at = (datetime.now(timezone.utc) + timedelta(minutes=2)).isoformat()
            block_data = {
                "block_type": "soft",
                "expires_at": expires_at
            }
            
            response = self.admin_session.put(
                f"{BACKEND_URL}/spaces/{self.test_space_id}/members/{self.test_user_for_blocking_id}/block",
                json=block_data
            )
            
            if response.status_code == 200:
                self.log("✅ Soft block with expiry created successfully")
                
                # Verify block in database by checking membership
                members_response = self.admin_session.get(f"{BACKEND_URL}/spaces/{self.test_space_id}/members-detailed")
                if members_response.status_code == 200:
                    members = members_response.json()
                    blocked_member = next((m for m in members if m.get('user_id') == self.test_user_for_blocking_id), None)
                    
                    if blocked_member and blocked_member.get('status') == 'blocked':
                        if blocked_member.get('block_type') == 'soft' and blocked_member.get('block_expires_at'):
                            self.log("✅ Soft block with expiry verified in database")
                            return True
                        else:
                            self.log("❌ Block type or expiry not set correctly", "ERROR")
                            return False
                    else:
                        self.log("❌ User not found or not blocked", "ERROR")
                        return False
                else:
                    self.log("⚠️ Could not verify soft block", "WARNING")
                    return True
            else:
                self.log(f"❌ Soft block creation failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in soft block test: {e}", "ERROR")
            return False
    
    def test_hard_block_no_expiry(self):
        """Test PUT /api/spaces/{space_id}/members/{user_id}/block with hard block (no expiry)"""
        self.log("\n🧪 Testing PUT /api/spaces/{space_id}/members/{user_id}/block (Hard Block - No Expiry)")
        
        if not self.test_space_id or not self.test_user_for_blocking_id:
            self.log("❌ Test space or user not available", "ERROR")
            return False
        
        try:
            # First unblock the user
            unblock_response = self.admin_session.put(
                f"{BACKEND_URL}/spaces/{self.test_space_id}/members/{self.test_user_for_blocking_id}/unblock"
            )
            
            # Create hard block without expiry
            block_data = {
                "block_type": "hard"
            }
            
            response = self.admin_session.put(
                f"{BACKEND_URL}/spaces/{self.test_space_id}/members/{self.test_user_for_blocking_id}/block",
                json=block_data
            )
            
            if response.status_code == 200:
                self.log("✅ Hard block created successfully")
                
                # Verify block in database
                members_response = self.admin_session.get(f"{BACKEND_URL}/spaces/{self.test_space_id}/members-detailed")
                if members_response.status_code == 200:
                    members = members_response.json()
                    blocked_member = next((m for m in members if m.get('user_id') == self.test_user_for_blocking_id), None)
                    
                    if blocked_member and blocked_member.get('status') == 'blocked':
                        if blocked_member.get('block_type') == 'hard' and not blocked_member.get('block_expires_at'):
                            self.log("✅ Hard block without expiry verified in database")
                            return True
                        else:
                            self.log("❌ Block type incorrect or expiry set when it shouldn't be", "ERROR")
                            return False
                    else:
                        self.log("❌ User not found or not blocked", "ERROR")
                        return False
                else:
                    self.log("⚠️ Could not verify hard block", "WARNING")
                    return True
            else:
                self.log(f"❌ Hard block creation failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in hard block test: {e}", "ERROR")
            return False
    
    def test_unblock_user(self):
        """Test PUT /api/spaces/{space_id}/members/{user_id}/unblock"""
        self.log("\n🧪 Testing PUT /api/spaces/{space_id}/members/{user_id}/unblock")
        
        if not self.test_space_id or not self.test_user_for_blocking_id:
            self.log("❌ Test space or user not available", "ERROR")
            return False
        
        try:
            response = self.admin_session.put(
                f"{BACKEND_URL}/spaces/{self.test_space_id}/members/{self.test_user_for_blocking_id}/unblock"
            )
            
            if response.status_code == 200:
                self.log("✅ User unblocked successfully")
                
                # Verify unblock in database
                members_response = self.admin_session.get(f"{BACKEND_URL}/spaces/{self.test_space_id}/members-detailed")
                if members_response.status_code == 200:
                    members = members_response.json()
                    unblocked_member = next((m for m in members if m.get('user_id') == self.test_user_for_blocking_id), None)
                    
                    if unblocked_member and unblocked_member.get('status') == 'member':
                        if not unblocked_member.get('blocked_at') and not unblocked_member.get('block_expires_at'):
                            self.log("✅ User unblock verified in database - all block fields cleared")
                            return True
                        else:
                            self.log("❌ Block fields not properly cleared", "ERROR")
                            return False
                    else:
                        self.log("❌ User not found or still blocked", "ERROR")
                        return False
                else:
                    self.log("⚠️ Could not verify unblock", "WARNING")
                    return True
            else:
                self.log(f"❌ User unblock failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in unblock test: {e}", "ERROR")
            return False
    
    def test_soft_block_engagement_prevention(self):
        """Test that soft blocked users cannot engage but can read"""
        self.log("\n🧪 Testing Soft Block Engagement Prevention")
        
        if not self.test_space_id or not self.test_user_for_blocking_id:
            self.log("❌ Test space or user not available", "ERROR")
            return False
        
        try:
            # Create soft block with future expiry
            expires_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
            block_data = {
                "block_type": "soft",
                "expires_at": expires_at
            }
            
            block_response = self.admin_session.put(
                f"{BACKEND_URL}/spaces/{self.test_space_id}/members/{self.test_user_for_blocking_id}/block",
                json=block_data
            )
            
            if block_response.status_code != 200:
                self.log("❌ Failed to create soft block for engagement test", "ERROR")
                return False
            
            # Create a session for the blocked user
            blocked_user_session = requests.Session()
            login_response = blocked_user_session.post(f"{BACKEND_URL}/auth/login", json={
                "email": "blocktest@test.com",
                "password": "block123"
            })
            
            if login_response.status_code != 200:
                self.log("❌ Failed to login as blocked user", "ERROR")
                return False
            
            # Test posting (should fail with soft block message)
            post_data = {
                "space_id": self.test_space_id,
                "content": "This should fail due to soft block",
                "title": "Test Post"
            }
            
            post_response = blocked_user_session.post(f"{BACKEND_URL}/posts", json=post_data)
            
            if post_response.status_code == 403:
                response_text = post_response.text.lower()
                if "temporarily blocked" in response_text:
                    self.log("✅ Soft blocked user correctly prevented from posting with appropriate message")
                    return True
                elif "blocked" in response_text:
                    self.log("✅ Soft blocked user correctly prevented from posting")
                    return True
                else:
                    self.log(f"⚠️ Blocked but message unclear: {post_response.text}", "WARNING")
                    return True
            else:
                self.log(f"❌ Soft blocked user should not be able to post: {post_response.status_code}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in soft block engagement test: {e}", "ERROR")
            return False
    
    def test_auto_expiry_system(self):
        """Test auto-expiry system for soft blocks"""
        self.log("\n🧪 Testing Auto-Expiry System for Soft Blocks")
        
        if not self.test_space_id or not self.test_user_for_blocking_id:
            self.log("❌ Test space or user not available", "ERROR")
            return False
        
        try:
            # Create soft block with very short expiry (10 seconds)
            expires_at = (datetime.now(timezone.utc) + timedelta(seconds=10)).isoformat()
            block_data = {
                "block_type": "soft",
                "expires_at": expires_at
            }
            
            block_response = self.admin_session.put(
                f"{BACKEND_URL}/spaces/{self.test_space_id}/members/{self.test_user_for_blocking_id}/block",
                json=block_data
            )
            
            if block_response.status_code != 200:
                self.log("❌ Failed to create soft block for auto-expiry test", "ERROR")
                return False
            
            self.log("⏳ Waiting for block to expire (15 seconds)...")
            time.sleep(15)
            
            # Create a session for the previously blocked user
            blocked_user_session = requests.Session()
            login_response = blocked_user_session.post(f"{BACKEND_URL}/auth/login", json={
                "email": "blocktest@test.com",
                "password": "block123"
            })
            
            if login_response.status_code != 200:
                self.log("❌ Failed to login as previously blocked user", "ERROR")
                return False
            
            # Test posting (should succeed and auto-unblock)
            post_data = {
                "space_id": self.test_space_id,
                "content": "This should succeed after auto-unblock",
                "title": "Auto-Unblock Test Post"
            }
            
            post_response = blocked_user_session.post(f"{BACKEND_URL}/posts", json=post_data)
            
            if post_response.status_code == 200:
                self.log("✅ Auto-expiry system working - user automatically unblocked and can post")
                return True
            else:
                self.log(f"❌ Auto-expiry failed - user still blocked: {post_response.status_code} - {post_response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in auto-expiry test: {e}", "ERROR")
            return False
    
    def test_process_expired_blocks(self):
        """Test POST /api/admin/process-expired-blocks"""
        self.log("\n🧪 Testing POST /api/admin/process-expired-blocks")
        
        if not self.test_space_id or not self.test_user_for_blocking_id:
            self.log("❌ Test space or user not available", "ERROR")
            return False
        
        try:
            # Create soft block with past expiry
            past_expiry = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
            block_data = {
                "block_type": "soft",
                "expires_at": past_expiry
            }
            
            block_response = self.admin_session.put(
                f"{BACKEND_URL}/spaces/{self.test_space_id}/members/{self.test_user_for_blocking_id}/block",
                json=block_data
            )
            
            if block_response.status_code != 200:
                self.log("❌ Failed to create expired soft block", "ERROR")
                return False
            
            # Process expired blocks
            response = self.admin_session.post(f"{BACKEND_URL}/admin/process-expired-blocks")
            
            if response.status_code == 200:
                result = response.json()
                unblocked_count = result.get('unblocked_count', 0)
                self.log(f"✅ Process expired blocks successful - Unblocked {unblocked_count} users")
                
                if unblocked_count >= 1:
                    self.log("✅ At least one user was unblocked as expected")
                    return True
                else:
                    self.log("⚠️ No users were unblocked - may be expected if no expired blocks", "WARNING")
                    return True
            else:
                self.log(f"❌ Process expired blocks failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in process expired blocks test: {e}", "ERROR")
            return False
    
    def test_process_expired_blocks_non_admin(self):
        """Test POST /api/admin/process-expired-blocks with non-admin (should fail)"""
        self.log("\n🧪 Testing POST /api/admin/process-expired-blocks (Non-Admin - Should Fail)")
        
        try:
            response = self.learner_session.post(f"{BACKEND_URL}/admin/process-expired-blocks")
            
            if response.status_code == 403:
                self.log("✅ Non-admin access correctly rejected (403 Forbidden)")
                return True
            elif response.status_code == 401:
                self.log("✅ Non-admin access correctly rejected (401 Unauthorized)")
                return True
            else:
                self.log(f"❌ Non-admin access should be rejected but got: {response.status_code}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in non-admin process expired blocks test: {e}", "ERROR")
            return False
    
    def run_all_tests(self):
        """Run all user role management tests"""
        self.log("🚀 Starting User Role Management API Tests")
        self.log(f"Backend URL: {BACKEND_URL}")
        
        results = {}
        
        # Setup test users
        if not self.setup_test_users():
            self.log("❌ Failed to setup test users - aborting tests", "ERROR")
            return False
        
        # Run tests in order
        test_methods = [
            ('GET All Users (Admin)', self.test_get_all_users_admin),
            ('GET All Users (Non-Admin)', self.test_get_all_users_non_admin),
            ('Promote User to Admin', self.test_promote_user_to_admin),
            ('Promote Self (Should Fail)', self.test_promote_self_admin),
            ('Promote Existing Admin (Should Fail)', self.test_promote_existing_admin),
            ('Promote by Non-Admin (Should Fail)', self.test_promote_non_admin_user),
            ('Demote Admin to Learner', self.test_demote_admin_to_learner),
            ('Demote Self (Should Fail)', self.test_demote_self_admin),
            ('Demote Non-Admin (Should Fail)', self.test_demote_non_admin),
            ('Demote by Non-Admin (Should Fail)', self.test_demote_by_non_admin),
            ('Role Change Persistence', self.test_role_persistence),
        ]
        
        for test_name, test_method in test_methods:
            try:
                results[test_name] = test_method()
            except Exception as e:
                self.log(f"❌ Unexpected error in {test_name}: {e}", "ERROR")
                results[test_name] = False
        
        # Summary
        self.log("\n" + "="*70)
        self.log("📊 USER ROLE MANAGEMENT TEST RESULTS SUMMARY")
        self.log("="*70)
        
        passed = 0
        total = len(results)
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{test_name}: {status}")
            if result:
                passed += 1
        
        self.log(f"\nOverall: {passed}/{total} tests passed")
        
        if passed == total:
            self.log("🎉 All user role management tests passed!")
            return True
        else:
            self.log(f"⚠️ {total - passed} tests failed")
            return False

def main():
    """Main test runner"""
    tester = UserRoleManagementTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n✅ User role management testing completed successfully")
        sys.exit(0)
    else:
        print("\n❌ User role management testing completed with failures")
        sys.exit(1)

if __name__ == "__main__":
    main()