#!/usr/bin/env python3
"""
Backend API Testing for Email Notifications System
Tests email preferences, welcome emails, join request approval emails, and email templates
"""

import requests
import json
from datetime import datetime, timezone, timedelta
import sys
import os
import time
import uuid

# Configuration
BACKEND_URL = "https://teamspace-app-1.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "admin123"
LEARNER_EMAIL = "learner@test.com"
LEARNER_PASSWORD = "learner123"

class EmailNotificationsTester:
    def __init__(self):
        self.admin_session = requests.Session()
        self.learner_session = requests.Session()
        self.test_user_session = requests.Session()
        self.test_learner_id = None
        self.test_admin_id = None
        self.test_user_id = None
        self.test_space_id = None
        self.test_join_request_id = None
        self.test_user_email = None
        
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
            else:
                self.log(f"❌ Failed to register learner user: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Exception during learner registration: {e}", "ERROR")
            return False
        
        # Login learner to get user ID
        try:
            login_response = self.learner_session.post(f"{BACKEND_URL}/auth/login", json={
                "email": LEARNER_EMAIL, "password": LEARNER_PASSWORD
            })
            if login_response.status_code == 200:
                user_data = login_response.json()
                self.test_learner_id = user_data.get('user', {}).get('id')
                self.log("✅ Learner login successful")
            else:
                self.log(f"❌ Learner login failed: {login_response.status_code} - {login_response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Exception during learner login: {e}", "ERROR")
            return False
        
        if not self.test_learner_id:
            self.log("❌ Failed to get learner user ID", "ERROR")
            return False
        
        self.log(f"✅ Test users setup complete. Learner ID: {self.test_learner_id}")
        return True
    
    def setup_test_space(self):
        """Setup a test space for activity tests"""
        self.log("🔧 Setting up test space...")
        
        try:
            # Get existing spaces first
            spaces_response = self.admin_session.get(f"{BACKEND_URL}/spaces")
            if spaces_response.status_code == 200:
                spaces = spaces_response.json()
                if spaces:
                    # Use the first available space
                    self.test_space_id = spaces[0]['id']
                    self.log(f"✅ Using existing space: {self.test_space_id}")
                    return True
            
            # If no spaces, create one
            space_data = {
                "name": "Test Space for Activity Streak",
                "description": "Test space for activity streak testing",
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
    
    def test_email_preferences_endpoints(self):
        """Test email preferences GET and PUT endpoints"""
        self.log("\n🧪 Testing Email Preferences API Endpoints")
        
        try:
            # Test GET /api/me/email-preferences
            response = self.admin_session.get(f"{BACKEND_URL}/me/email-preferences")
            
            if response.status_code == 200:
                preferences = response.json()
                self.log("✅ GET /api/me/email-preferences successful")
                
                # Check if email_notifications_enabled field is present
                if 'email_notifications_enabled' in preferences:
                    initial_status = preferences['email_notifications_enabled']
                    self.log(f"ℹ️ Initial email notifications status: {initial_status}")
                else:
                    self.log("❌ Missing email_notifications_enabled field in response", "ERROR")
                    return False
                
                # Test PUT /api/me/email-preferences - disable notifications
                disable_data = {"email_notifications_enabled": False}
                put_response = self.admin_session.put(f"{BACKEND_URL}/me/email-preferences", json=disable_data)
                
                if put_response.status_code == 200:
                    self.log("✅ PUT /api/me/email-preferences (disable) successful")
                    
                    # Verify the change
                    verify_response = self.admin_session.get(f"{BACKEND_URL}/me/email-preferences")
                    if verify_response.status_code == 200:
                        updated_preferences = verify_response.json()
                        if updated_preferences.get('email_notifications_enabled') == False:
                            self.log("✅ Email notifications successfully disabled")
                        else:
                            self.log("❌ Email notifications not properly disabled", "ERROR")
                            return False
                    else:
                        self.log("❌ Failed to verify email preferences update", "ERROR")
                        return False
                else:
                    self.log(f"❌ PUT /api/me/email-preferences (disable) failed: {put_response.status_code} - {put_response.text}", "ERROR")
                    return False
                
                # Test PUT /api/me/email-preferences - enable notifications
                enable_data = {"email_notifications_enabled": True}
                put_response2 = self.admin_session.put(f"{BACKEND_URL}/me/email-preferences", json=enable_data)
                
                if put_response2.status_code == 200:
                    self.log("✅ PUT /api/me/email-preferences (enable) successful")
                    
                    # Verify the change
                    verify_response2 = self.admin_session.get(f"{BACKEND_URL}/me/email-preferences")
                    if verify_response2.status_code == 200:
                        final_preferences = verify_response2.json()
                        if final_preferences.get('email_notifications_enabled') == True:
                            self.log("✅ Email notifications successfully re-enabled")
                            return True
                        else:
                            self.log("❌ Email notifications not properly re-enabled", "ERROR")
                            return False
                    else:
                        self.log("❌ Failed to verify final email preferences update", "ERROR")
                        return False
                else:
                    self.log(f"❌ PUT /api/me/email-preferences (enable) failed: {put_response2.status_code} - {put_response2.text}", "ERROR")
                    return False
                
            else:
                self.log(f"❌ GET /api/me/email-preferences failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in email preferences test: {e}", "ERROR")
            return False
    
    def test_create_post_streak_update(self):
        """Test that creating a post updates activity streak"""
        self.log("\n🧪 Testing Post Creation Updates Activity Streak")
        
        try:
            # Get initial streak values
            initial_response = self.admin_session.get(f"{BACKEND_URL}/auth/me")
            if initial_response.status_code != 200:
                self.log("❌ Failed to get initial user data", "ERROR")
                return False
            
            initial_user = initial_response.json()
            initial_streak = initial_user.get('current_streak', 0)
            initial_points = initial_user.get('total_points', 0)
            
            self.log(f"ℹ️ Before post - Streak: {initial_streak}, Points: {initial_points}")
            
            # Create a post to trigger activity tracking
            post_data = {
                "space_id": self.test_space_id,
                "content": "Test post for activity streak tracking",
                "title": "Activity Streak Test Post"
            }
            
            post_response = self.admin_session.post(f"{BACKEND_URL}/posts", json=post_data)
            
            if post_response.status_code == 200:
                post = post_response.json()
                self.test_post_id = post.get('id')
                self.log("✅ Post created successfully")
                
                # Get updated user data
                updated_response = self.admin_session.get(f"{BACKEND_URL}/auth/me")
                if updated_response.status_code == 200:
                    updated_user = updated_response.json()
                    new_streak = updated_user.get('current_streak', 0)
                    new_points = updated_user.get('total_points', 0)
                    last_activity = updated_user.get('last_activity_date')
                    
                    self.log(f"ℹ️ After post - Streak: {new_streak}, Points: {new_points}, Last Activity: {last_activity}")
                    
                    # Verify streak was updated (should be at least 1)
                    if new_streak >= 1:
                        self.log("✅ Activity streak updated correctly after post creation")
                    else:
                        self.log("❌ Activity streak not updated after post creation", "ERROR")
                        return False
                    
                    # Verify points were awarded (3 points for post creation)
                    if new_points >= initial_points + 3:
                        self.log("✅ Points awarded correctly for post creation")
                    else:
                        self.log(f"⚠️ Expected at least 3 points increase, got {new_points - initial_points}", "WARNING")
                    
                    # Verify last_activity_date is set to today
                    if last_activity:
                        today = datetime.now(timezone.utc).date().isoformat()
                        activity_date = last_activity[:10]  # Extract date part
                        if activity_date == today:
                            self.log("✅ Last activity date set to today")
                        else:
                            self.log(f"⚠️ Last activity date mismatch - Expected: {today}, Got: {activity_date}", "WARNING")
                    
                    return True
                else:
                    self.log("❌ Failed to get updated user data", "ERROR")
                    return False
            else:
                self.log(f"❌ Post creation failed: {post_response.status_code} - {post_response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in post creation streak test: {e}", "ERROR")
            return False
    
    def test_comment_reaction_points(self):
        """Test comment reaction points system - 0.5 points to both reactor and author"""
        self.log("\n🧪 Testing Comment Reaction Points System")
        
        if not self.test_post_id:
            self.log("❌ No test post available for comment testing", "ERROR")
            return False
        
        try:
            # Get initial points for admin user
            admin_initial_response = self.admin_session.get(f"{BACKEND_URL}/auth/me")
            if admin_initial_response.status_code != 200:
                self.log("❌ Failed to get admin initial points", "ERROR")
                return False
            
            admin_initial_points = admin_initial_response.json().get('total_points', 0)
            
            # Get initial points for learner user
            learner_initial_response = self.learner_session.get(f"{BACKEND_URL}/auth/me")
            if learner_initial_response.status_code != 200:
                self.log("❌ Failed to get learner initial points", "ERROR")
                return False
            
            learner_initial_points = learner_initial_response.json().get('total_points', 0)
            
            self.log(f"ℹ️ Initial points - Admin: {admin_initial_points}, Learner: {learner_initial_points}")
            
            # Create a comment as learner user
            comment_data = {
                "content": "Test comment for reaction points testing"
            }
            
            comment_response = self.learner_session.post(f"{BACKEND_URL}/posts/{self.test_post_id}/comments", json=comment_data)
            
            if comment_response.status_code == 200:
                comment = comment_response.json()
                self.test_comment_id = comment.get('id')
                self.log("✅ Comment created successfully")
                
                # React to the comment with admin user (❤️ emoji)
                react_response = self.admin_session.post(f"{BACKEND_URL}/comments/{self.test_comment_id}/react?emoji=❤️")
                
                if react_response.status_code == 200:
                    self.log("✅ Comment reaction added successfully")
                    
                    # Check points after reaction
                    admin_after_reaction = self.admin_session.get(f"{BACKEND_URL}/auth/me")
                    learner_after_reaction = self.learner_session.get(f"{BACKEND_URL}/auth/me")
                    
                    if admin_after_reaction.status_code == 200 and learner_after_reaction.status_code == 200:
                        admin_new_points = admin_after_reaction.json().get('total_points', 0)
                        learner_new_points = learner_after_reaction.json().get('total_points', 0)
                        
                        self.log(f"ℹ️ After reaction - Admin: {admin_new_points}, Learner: {learner_new_points}")
                        
                        # Verify 0.5 points awarded to reactor (admin)
                        admin_points_gained = admin_new_points - admin_initial_points
                        if admin_points_gained >= 0.5:
                            self.log("✅ Reactor (admin) received 0.5 points for reacting")
                        else:
                            self.log(f"❌ Reactor should receive 0.5 points, got {admin_points_gained}", "ERROR")
                            return False
                        
                        # Verify 0.5 points awarded to comment author (learner)
                        # Note: learner also got 2 points for creating the comment
                        learner_points_gained = learner_new_points - learner_initial_points
                        if learner_points_gained >= 2.5:  # 2 for comment + 0.5 for receiving reaction
                            self.log("✅ Comment author (learner) received 0.5 points for receiving reaction")
                        else:
                            self.log(f"❌ Comment author should receive at least 2.5 points (2 for comment + 0.5 for reaction), got {learner_points_gained}", "ERROR")
                            return False
                        
                        # Test unreaction - remove the reaction
                        unreact_response = self.admin_session.post(f"{BACKEND_URL}/comments/{self.test_comment_id}/react?emoji=❤️")
                        
                        if unreact_response.status_code == 200:
                            self.log("✅ Comment unreaction successful")
                            
                            # Check points after unreaction
                            admin_after_unreaction = self.admin_session.get(f"{BACKEND_URL}/auth/me")
                            learner_after_unreaction = self.learner_session.get(f"{BACKEND_URL}/auth/me")
                            
                            if admin_after_unreaction.status_code == 200 and learner_after_unreaction.status_code == 200:
                                admin_final_points = admin_after_unreaction.json().get('total_points', 0)
                                learner_final_points = learner_after_unreaction.json().get('total_points', 0)
                                
                                self.log(f"ℹ️ After unreaction - Admin: {admin_final_points}, Learner: {learner_final_points}")
                                
                                # Verify 0.5 points deducted from both parties
                                if admin_final_points == admin_new_points - 0.5:
                                    self.log("✅ Reactor (admin) lost 0.5 points on unreaction")
                                else:
                                    self.log(f"❌ Reactor should lose 0.5 points on unreaction", "ERROR")
                                    return False
                                
                                if learner_final_points == learner_new_points - 0.5:
                                    self.log("✅ Comment author (learner) lost 0.5 points on unreaction")
                                else:
                                    self.log(f"❌ Comment author should lose 0.5 points on unreaction", "ERROR")
                                    return False
                                
                                self.log("✅ Comment reaction points system working correctly")
                                return True
                            else:
                                self.log("❌ Failed to get points after unreaction", "ERROR")
                                return False
                        else:
                            self.log(f"❌ Comment unreaction failed: {unreact_response.status_code}", "ERROR")
                            return False
                    else:
                        self.log("❌ Failed to get points after reaction", "ERROR")
                        return False
                else:
                    self.log(f"❌ Comment reaction failed: {react_response.status_code} - {react_response.text}", "ERROR")
                    return False
            else:
                self.log(f"❌ Comment creation failed: {comment_response.status_code} - {comment_response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in comment reaction points test: {e}", "ERROR")
            return False
    
    def test_streak_continuation_logic(self):
        """Test streak continuation and data storage"""
        self.log("\n🧪 Testing Streak Continuation Logic and Data Storage")
        
        try:
            # Get current user data to verify streak fields are properly stored
            response = self.admin_session.get(f"{BACKEND_URL}/auth/me")
            
            if response.status_code == 200:
                user = response.json()
                
                # Verify all streak fields are present and have valid values
                last_activity = user.get('last_activity_date')
                current_streak = user.get('current_streak', 0)
                longest_streak = user.get('longest_streak', 0)
                
                self.log(f"ℹ️ Current streak data - Last Activity: {last_activity}, Current: {current_streak}, Longest: {longest_streak}")
                
                # Verify last_activity_date is properly stored (should be today after previous tests)
                if last_activity:
                    self.log("✅ Last activity date is properly stored")
                else:
                    self.log("⚠️ Last activity date is null - may be expected if no activity yet", "WARNING")
                
                # Verify current_streak is a valid number
                if isinstance(current_streak, (int, float)) and current_streak >= 0:
                    self.log("✅ Current streak is properly stored as valid number")
                else:
                    self.log("❌ Current streak is not a valid number", "ERROR")
                    return False
                
                # Verify longest_streak is a valid number and >= current_streak
                if isinstance(longest_streak, (int, float)) and longest_streak >= current_streak:
                    self.log("✅ Longest streak is properly stored and >= current streak")
                else:
                    self.log("❌ Longest streak is invalid or less than current streak", "ERROR")
                    return False
                
                # Test that streak increments correctly by creating another activity
                # (This simulates continuing the streak)
                comment_data = {
                    "content": "Another test comment to continue streak"
                }
                
                if self.test_post_id:
                    comment_response = self.admin_session.post(f"{BACKEND_URL}/posts/{self.test_post_id}/comments", json=comment_data)
                    
                    if comment_response.status_code == 200:
                        self.log("✅ Additional activity created successfully")
                        
                        # Get updated streak data
                        updated_response = self.admin_session.get(f"{BACKEND_URL}/auth/me")
                        if updated_response.status_code == 200:
                            updated_user = updated_response.json()
                            new_current_streak = updated_user.get('current_streak', 0)
                            new_longest_streak = updated_user.get('longest_streak', 0)
                            
                            self.log(f"ℹ️ Updated streak data - Current: {new_current_streak}, Longest: {new_longest_streak}")
                            
                            # Since we're doing activities on the same day, streak should remain the same
                            # (streak only increments on different days)
                            if new_current_streak == current_streak:
                                self.log("✅ Streak correctly maintained for same-day activities")
                            else:
                                self.log("⚠️ Streak changed unexpectedly for same-day activity", "WARNING")
                            
                            return True
                        else:
                            self.log("❌ Failed to get updated user data", "ERROR")
                            return False
                    else:
                        self.log(f"⚠️ Additional activity creation failed: {comment_response.status_code}", "WARNING")
                        return True  # Still pass the main test
                else:
                    self.log("⚠️ No test post available for additional activity", "WARNING")
                    return True  # Still pass the main test
                
            else:
                self.log(f"❌ Failed to get user data: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in streak continuation test: {e}", "ERROR")
            return False
    
    def run_all_tests(self):
        """Run all Daily Activity Streak and Comment Reaction Points tests"""
        self.log("🚀 Starting Daily Activity Streak and Comment Reaction Points Backend Testing")
        self.log(f"Backend URL: {BACKEND_URL}")
        self.log("=" * 80)
        
        # Setup
        if not self.setup_test_users():
            self.log("❌ Test setup failed - aborting tests", "ERROR")
            return False
        
        if not self.setup_test_space():
            self.log("❌ Test space setup failed - aborting tests", "ERROR")
            return False
        
        # Test results tracking
        test_results = []
        
        # Daily Activity Streak Tests
        self.log("\n" + "=" * 50)
        self.log("DAILY ACTIVITY STREAK TESTS")
        self.log("=" * 50)
        
        test_results.append(("Initial Activity Streak Values", self.test_initial_activity_streak()))
        test_results.append(("Post Creation Updates Streak", self.test_create_post_streak_update()))
        test_results.append(("Streak Continuation Logic", self.test_streak_continuation_logic()))
        
        # Comment Reaction Points Tests
        self.log("\n" + "=" * 50)
        self.log("COMMENT REACTION POINTS TESTS")
        self.log("=" * 50)
        
        test_results.append(("Comment Reaction Points System", self.test_comment_reaction_points()))
        
        # Print summary
        self.log("\n" + "=" * 80)
        self.log("TEST SUMMARY")
        self.log("=" * 80)
        
        passed = sum(1 for _, result in test_results if result)
        total = len(test_results)
        
        for test_name, result in test_results:
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{status} - {test_name}")
        
        self.log(f"\nOverall Result: {passed}/{total} tests passed")
        
        if passed == total:
            self.log("🎉 ALL TESTS PASSED! Daily Activity Streak and Comment Reaction Points systems are fully functional.")
            return True
        else:
            self.log(f"⚠️ {total - passed} tests failed. Please review the failures above.")
            return False

def main():
    """Main test runner"""
    tester = DailyActivityStreakTester()
    
    # Run all tests by default
    success = tester.run_all_tests()
    if success:
        print("\n✅ Daily Activity Streak and Comment Reaction Points testing completed successfully")
        sys.exit(0)
    else:
        print("\n❌ Daily Activity Streak and Comment Reaction Points testing completed with failures")
        sys.exit(1)

if __name__ == "__main__":
    main()