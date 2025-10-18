#!/usr/bin/env python3
"""
Member and Space Manager Management System Testing
Tests the enhanced member and space manager management endpoints
"""

import requests
import json
from datetime import datetime, timezone, timedelta
import sys
import os

# Configuration
BACKEND_URL = "https://community-gates.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "admin123"
MANAGER_EMAIL = "manager@test.com"
MANAGER_PASSWORD = "manager123"
REGULAR_EMAIL = "regular@test.com"
REGULAR_PASSWORD = "regular123"

class MemberManagerTester:
    def __init__(self):
        self.admin_session = requests.Session()
        self.manager_session = requests.Session()
        self.regular_session = requests.Session()
        self.test_space_id = None
        self.test_manager_id = None
        self.test_regular_id = None
        self.admin_id = None
        
    def log(self, message, level="INFO"):
        """Log test messages"""
        print(f"[{level}] {message}")
        
    def setup_test_users(self):
        """Setup admin, manager, and regular users for testing"""
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
                user_data = response.json()
                self.admin_id = user_data.get('user', {}).get('id')
            elif response.status_code == 400 and "already registered" in response.text:
                self.log("ℹ️ Admin user already exists")
                # Login to get admin ID
                login_response = self.admin_session.post(f"{BACKEND_URL}/auth/login", json={
                    "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
                })
                if login_response.status_code == 200:
                    user_data = login_response.json()
                    self.admin_id = user_data.get('user', {}).get('id')
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
        
        # Setup manager user (will be promoted to manager later)
        manager_data = {
            "email": MANAGER_EMAIL,
            "password": MANAGER_PASSWORD,
            "name": "Test Manager User",
            "role": "learner"
        }
        
        try:
            response = self.manager_session.post(f"{BACKEND_URL}/auth/register", json=manager_data)
            if response.status_code == 200:
                self.log("✅ Manager user registered successfully")
                user_data = response.json()
                self.test_manager_id = user_data.get('user', {}).get('id')
            elif response.status_code == 400 and "already registered" in response.text:
                self.log("ℹ️ Manager user already exists")
                # Login to get user ID
                login_response = self.manager_session.post(f"{BACKEND_URL}/auth/login", json={
                    "email": MANAGER_EMAIL, "password": MANAGER_PASSWORD
                })
                if login_response.status_code == 200:
                    user_data = login_response.json()
                    self.test_manager_id = user_data.get('user', {}).get('id')
            else:
                self.log(f"❌ Failed to register manager user: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Exception during manager registration: {e}", "ERROR")
            return False
        
        # Setup regular user
        regular_data = {
            "email": REGULAR_EMAIL,
            "password": REGULAR_PASSWORD,
            "name": "Test Regular User",
            "role": "learner"
        }
        
        try:
            response = self.regular_session.post(f"{BACKEND_URL}/auth/register", json=regular_data)
            if response.status_code == 200:
                self.log("✅ Regular user registered successfully")
                user_data = response.json()
                self.test_regular_id = user_data.get('user', {}).get('id')
            elif response.status_code == 400 and "already registered" in response.text:
                self.log("ℹ️ Regular user already exists")
                # Login to get user ID
                login_response = self.regular_session.post(f"{BACKEND_URL}/auth/login", json={
                    "email": REGULAR_EMAIL, "password": REGULAR_PASSWORD
                })
                if login_response.status_code == 200:
                    user_data = login_response.json()
                    self.test_regular_id = user_data.get('user', {}).get('id')
            else:
                self.log(f"❌ Failed to register regular user: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Exception during regular registration: {e}", "ERROR")
            return False
        
        if not all([self.admin_id, self.test_manager_id, self.test_regular_id]):
            self.log("❌ Failed to get all user IDs", "ERROR")
            return False
        
        self.log(f"✅ Test users setup complete. Admin: {self.admin_id}, Manager: {self.test_manager_id}, Regular: {self.test_regular_id}")
        return True
    
    def setup_test_space(self):
        """Create a test space for manager testing"""
        self.log("🔧 Setting up test space...")
        
        space_data = {
            "name": "Test Manager Space",
            "description": "Space for testing manager functionality",
            "visibility": "public",
            "space_type": "post",
            "allow_member_posts": True
        }
        
        try:
            response = self.admin_session.post(f"{BACKEND_URL}/admin/spaces", json=space_data)
            if response.status_code == 200:
                space = response.json()
                self.test_space_id = space.get('id')
                self.log(f"✅ Test space created successfully: {self.test_space_id}")
                return True
            else:
                self.log(f"❌ Failed to create test space: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Exception during space creation: {e}", "ERROR")
            return False
    
    def add_members_to_space(self):
        """Add test users as members to the test space"""
        self.log("🔧 Adding members to test space...")
        
        # Add manager user to space
        try:
            response = self.manager_session.post(f"{BACKEND_URL}/spaces/{self.test_space_id}/join")
            if response.status_code == 200:
                self.log("✅ Manager user joined space successfully")
            else:
                self.log(f"❌ Manager user failed to join space: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Exception during manager join: {e}", "ERROR")
            return False
        
        # Add regular user to space
        try:
            response = self.regular_session.post(f"{BACKEND_URL}/spaces/{self.test_space_id}/join")
            if response.status_code == 200:
                self.log("✅ Regular user joined space successfully")
            else:
                self.log(f"❌ Regular user failed to join space: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Exception during regular join: {e}", "ERROR")
            return False
        
        return True
    
    def test_promote_member_to_manager(self):
        """Test PUT /api/spaces/{space_id}/members/{user_id}/promote"""
        self.log("\n🧪 Testing PUT /api/spaces/{space_id}/members/{user_id}/promote")
        
        if not self.test_space_id or not self.test_manager_id:
            self.log("❌ Missing test space or manager ID", "ERROR")
            return False
        
        try:
            response = self.admin_session.put(f"{BACKEND_URL}/spaces/{self.test_space_id}/members/{self.test_manager_id}/promote")
            
            if response.status_code == 200:
                self.log("✅ Member promoted to manager successfully")
                
                # Verify promotion by checking membership
                members_response = self.admin_session.get(f"{BACKEND_URL}/spaces/{self.test_space_id}/members-detailed")
                if members_response.status_code == 200:
                    members = members_response.json()
                    promoted_member = next((m for m in members if m.get('user', {}).get('id') == self.test_manager_id), None)
                    
                    if promoted_member and promoted_member.get('role') == 'manager':
                        self.log("✅ Member promotion verified - role updated to manager")
                        return True
                    else:
                        self.log("⚠️ Member promotion not reflected in membership", "WARNING")
                        return False
                else:
                    self.log("⚠️ Could not verify promotion", "WARNING")
                    return True
            else:
                self.log(f"❌ Member promotion failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in promote member: {e}", "ERROR")
            return False
    
    def test_get_managed_spaces_with_manager(self):
        """Test GET /api/users/{user_id}/managed-spaces for user who is manager"""
        self.log("\n🧪 Testing GET /api/users/{user_id}/managed-spaces (User with Manager Role)")
        
        if not self.test_manager_id:
            self.log("❌ Missing test manager ID", "ERROR")
            return False
        
        try:
            response = self.admin_session.get(f"{BACKEND_URL}/users/{self.test_manager_id}/managed-spaces")
            
            if response.status_code == 200:
                managed_spaces = response.json()
                self.log(f"✅ GET managed spaces successful - Retrieved {len(managed_spaces)} spaces")
                
                # Verify the test space is in the list
                test_space_found = any(space.get('id') == self.test_space_id for space in managed_spaces)
                
                if test_space_found:
                    self.log("✅ Test space found in managed spaces list")
                    return True
                else:
                    self.log("⚠️ Test space not found in managed spaces list", "WARNING")
                    return False
            else:
                self.log(f"❌ GET managed spaces failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in GET managed spaces: {e}", "ERROR")
            return False
    
    def test_get_managed_spaces_no_manager(self):
        """Test GET /api/users/{user_id}/managed-spaces for user who is not a manager"""
        self.log("\n🧪 Testing GET /api/users/{user_id}/managed-spaces (User with No Manager Role)")
        
        if not self.test_regular_id:
            self.log("❌ Missing test regular user ID", "ERROR")
            return False
        
        try:
            response = self.admin_session.get(f"{BACKEND_URL}/users/{self.test_regular_id}/managed-spaces")
            
            if response.status_code == 200:
                managed_spaces = response.json()
                self.log(f"✅ GET managed spaces successful - Retrieved {len(managed_spaces)} spaces")
                
                # Should return empty list for non-manager
                if len(managed_spaces) == 0:
                    self.log("✅ Correctly returned empty list for non-manager user")
                    return True
                else:
                    self.log(f"⚠️ Expected empty list but got {len(managed_spaces)} spaces", "WARNING")
                    return False
            else:
                self.log(f"❌ GET managed spaces failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in GET managed spaces: {e}", "ERROR")
            return False
    
    def test_get_managed_spaces_non_admin(self):
        """Test GET /api/users/{user_id}/managed-spaces with non-admin user (should fail)"""
        self.log("\n🧪 Testing GET /api/users/{user_id}/managed-spaces (Non-Admin Access - Should Fail)")
        
        if not self.test_manager_id:
            self.log("❌ Missing test manager ID", "ERROR")
            return False
        
        try:
            response = self.regular_session.get(f"{BACKEND_URL}/users/{self.test_manager_id}/managed-spaces")
            
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
            self.log(f"❌ Exception in non-admin GET managed spaces: {e}", "ERROR")
            return False
    
    def test_demote_manager_to_member(self):
        """Test PUT /api/spaces/{space_id}/members/{user_id}/demote"""
        self.log("\n🧪 Testing PUT /api/spaces/{space_id}/members/{user_id}/demote")
        
        if not self.test_space_id or not self.test_manager_id:
            self.log("❌ Missing test space or manager ID", "ERROR")
            return False
        
        try:
            response = self.admin_session.put(f"{BACKEND_URL}/spaces/{self.test_space_id}/members/{self.test_manager_id}/demote")
            
            if response.status_code == 200:
                self.log("✅ Manager demoted to member successfully")
                
                # Verify demotion by checking membership
                members_response = self.admin_session.get(f"{BACKEND_URL}/spaces/{self.test_space_id}/members-detailed")
                if members_response.status_code == 200:
                    members = members_response.json()
                    demoted_member = next((m for m in members if m.get('user', {}).get('id') == self.test_manager_id), None)
                    
                    if demoted_member and demoted_member.get('role') == 'member':
                        self.log("✅ Manager demotion verified - role updated to member")
                        return True
                    else:
                        self.log("⚠️ Manager demotion not reflected in membership", "WARNING")
                        return False
                else:
                    self.log("⚠️ Could not verify demotion", "WARNING")
                    return True
            else:
                self.log(f"❌ Manager demotion failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in demote manager: {e}", "ERROR")
            return False
    
    def test_promote_non_admin_access(self):
        """Test promotion by non-admin user (should fail)"""
        self.log("\n🧪 Testing PUT /api/spaces/{space_id}/members/{user_id}/promote (Non-Admin - Should Fail)")
        
        if not self.test_space_id or not self.test_regular_id:
            self.log("❌ Missing test space or regular user ID", "ERROR")
            return False
        
        try:
            response = self.regular_session.put(f"{BACKEND_URL}/spaces/{self.test_space_id}/members/{self.test_regular_id}/promote")
            
            if response.status_code == 403:
                self.log("✅ Non-admin promotion correctly rejected (403 Forbidden)")
                return True
            elif response.status_code == 401:
                self.log("✅ Non-admin promotion correctly rejected (401 Unauthorized)")
                return True
            else:
                self.log(f"❌ Non-admin promotion should be rejected but got: {response.status_code}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in non-admin promotion test: {e}", "ERROR")
            return False
    
    def test_demote_non_admin_access(self):
        """Test demotion by non-admin user (should fail)"""
        self.log("\n🧪 Testing PUT /api/spaces/{space_id}/members/{user_id}/demote (Non-Admin - Should Fail)")
        
        if not self.test_space_id or not self.test_manager_id:
            self.log("❌ Missing test space or manager ID", "ERROR")
            return False
        
        try:
            response = self.regular_session.put(f"{BACKEND_URL}/spaces/{self.test_space_id}/members/{self.test_manager_id}/demote")
            
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
    
    def test_get_managed_spaces_after_demotion(self):
        """Test GET /api/users/{user_id}/managed-spaces after demotion (should be empty)"""
        self.log("\n🧪 Testing GET /api/users/{user_id}/managed-spaces (After Demotion - Should Be Empty)")
        
        if not self.test_manager_id:
            self.log("❌ Missing test manager ID", "ERROR")
            return False
        
        try:
            response = self.admin_session.get(f"{BACKEND_URL}/users/{self.test_manager_id}/managed-spaces")
            
            if response.status_code == 200:
                managed_spaces = response.json()
                self.log(f"✅ GET managed spaces successful - Retrieved {len(managed_spaces)} spaces")
                
                # Should return empty list after demotion
                if len(managed_spaces) == 0:
                    self.log("✅ Correctly returned empty list after demotion")
                    return True
                else:
                    self.log(f"⚠️ Expected empty list after demotion but got {len(managed_spaces)} spaces", "WARNING")
                    return False
            else:
                self.log(f"❌ GET managed spaces failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in GET managed spaces after demotion: {e}", "ERROR")
            return False
    
    def run_all_tests(self):
        """Run all member and space manager management tests"""
        self.log("🚀 Starting Member and Space Manager Management API Tests")
        self.log(f"Backend URL: {BACKEND_URL}")
        
        results = {}
        
        # Setup test users
        if not self.setup_test_users():
            self.log("❌ Failed to setup test users - aborting tests", "ERROR")
            return False
        
        # Setup test space
        if not self.setup_test_space():
            self.log("❌ Failed to setup test space - aborting tests", "ERROR")
            return False
        
        # Add members to space
        if not self.add_members_to_space():
            self.log("❌ Failed to add members to space - aborting tests", "ERROR")
            return False
        
        # Run tests in order
        test_methods = [
            ('Promote Member to Manager', self.test_promote_member_to_manager),
            ('GET Managed Spaces (With Manager Role)', self.test_get_managed_spaces_with_manager),
            ('GET Managed Spaces (No Manager Role)', self.test_get_managed_spaces_no_manager),
            ('GET Managed Spaces (Non-Admin Access)', self.test_get_managed_spaces_non_admin),
            ('Promote by Non-Admin (Should Fail)', self.test_promote_non_admin_access),
            ('Demote by Non-Admin (Should Fail)', self.test_demote_non_admin_access),
            ('Demote Manager to Member', self.test_demote_manager_to_member),
            ('GET Managed Spaces After Demotion', self.test_get_managed_spaces_after_demotion),
        ]
        
        for test_name, test_method in test_methods:
            try:
                results[test_name] = test_method()
            except Exception as e:
                self.log(f"❌ Unexpected error in {test_name}: {e}", "ERROR")
                results[test_name] = False
        
        # Summary
        self.log("\n" + "="*70)
        self.log("📊 MEMBER AND SPACE MANAGER MANAGEMENT TEST RESULTS SUMMARY")
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
            self.log("🎉 All member and space manager management tests passed!")
            return True
        else:
            self.log(f"⚠️ {total - passed} tests failed")
            return False

def main():
    """Main test runner"""
    tester = MemberManagerTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n✅ Member and space manager management testing completed successfully")
        sys.exit(0)
    else:
        print("\n❌ Member and space manager management testing completed with failures")
        sys.exit(1)

if __name__ == "__main__":
    main()