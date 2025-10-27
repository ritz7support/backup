#!/usr/bin/env python3
"""
Reaction Points System Testing
Tests the reaction points system to verify that points are properly awarded and deducted
"""

import requests
import json
from datetime import datetime, timezone, timedelta
import sys
import os
import time

# Configuration
BACKEND_URL = "https://teamspace-app-1.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "admin123"

class ReactionPointsTester:
    def __init__(self):
        self.admin_session = requests.Session()
        self.test_post_id = None
        self.test_comment_id = None
        self.initial_points = 0
        self.points_after_post = 0
        self.points_after_reaction = 0
        self.points_after_unreaction = 0
        self.test_space_id = None
        
    def log(self, message, level="INFO"):
        """Log test messages"""
        print(f"[{level}] {message}")
        
    def setup_admin_session(self):
        """Setup admin session for testing"""
        self.log("🔧 Setting up admin session...")
        
        try:
            # Login admin
            login_data = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
            response = self.admin_session.post(f"{BACKEND_URL}/auth/login", json=login_data)
            if response.status_code == 200:
                self.log("✅ Admin login successful")
                return True
            else:
                self.log(f"❌ Admin login failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Exception during admin login: {e}", "ERROR")
            return False
    
    def get_initial_points(self):
        """Get initial points from /api/auth/me"""
        self.log("\n🧪 Step 1: Getting Initial Points")
        
        try:
            response = self.admin_session.get(f"{BACKEND_URL}/auth/me")
            if response.status_code == 200:
                user_data = response.json()
                self.initial_points = user_data.get('total_points', 0)
                self.log(f"✅ Initial total_points: {self.initial_points}")
                return True
            else:
                self.log(f"❌ Failed to get user data: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Exception getting initial points: {e}", "ERROR")
            return False
    
    def get_public_space(self):
        """Get a public space for testing"""
        self.log("🔧 Getting public space for testing...")
        
        try:
            response = self.admin_session.get(f"{BACKEND_URL}/spaces")
            if response.status_code == 200:
                spaces = response.json()
                # Find a public space
                for space in spaces:
                    if space.get('visibility') == 'public':
                        self.test_space_id = space['id']
                        self.log(f"✅ Using public space: {space['name']} (ID: {self.test_space_id})")
                        return True
                
                # If no public space found, use the first available space
                if spaces:
                    self.test_space_id = spaces[0]['id']
                    self.log(f"✅ Using first available space: {spaces[0]['name']} (ID: {self.test_space_id})")
                    return True
                else:
                    self.log("❌ No spaces available", "ERROR")
                    return False
            else:
                self.log(f"❌ Failed to get spaces: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Exception getting spaces: {e}", "ERROR")
            return False
    
    def create_test_post(self):
        """Create a test post and record points after post creation"""
        self.log("\n🧪 Step 2: Creating Test Post")
        
        if not self.test_space_id:
            self.log("❌ No test space available", "ERROR")
            return False
        
        try:
            post_data = {
                "content": "Test post for reaction points testing",
                "type": "post",
                "space_id": self.test_space_id
            }
            
            response = self.admin_session.post(f"{BACKEND_URL}/posts", json=post_data)
            if response.status_code == 200:
                post = response.json()
                self.test_post_id = post.get('id')
                self.log(f"✅ Test post created successfully (ID: {self.test_post_id})")
                
                # Get points after post creation
                me_response = self.admin_session.get(f"{BACKEND_URL}/auth/me")
                if me_response.status_code == 200:
                    user_data = me_response.json()
                    self.points_after_post = user_data.get('total_points', 0)
                    points_gained = self.points_after_post - self.initial_points
                    self.log(f"✅ Points after post creation: {self.points_after_post} (gained: {points_gained})")
                    return True
                else:
                    self.log("⚠️ Could not get points after post creation", "WARNING")
                    return True
            else:
                self.log(f"❌ Failed to create test post: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Exception creating test post: {e}", "ERROR")
            return False
    
    def react_to_post(self):
        """React to the test post and verify points increase"""
        self.log("\n🧪 Step 3: Reacting to Post (Add Reaction)")
        
        if not self.test_post_id:
            self.log("❌ No test post available", "ERROR")
            return False
        
        try:
            # React to post with thumbs up
            response = self.admin_session.post(f"{BACKEND_URL}/posts/{self.test_post_id}/react?emoji=👍")
            if response.status_code == 200:
                self.log("✅ Reaction added successfully")
                
                # Verify reaction was added
                post_response = self.admin_session.get(f"{BACKEND_URL}/posts/{self.test_post_id}")
                if post_response.status_code == 200:
                    post_data = post_response.json()
                    reactions = post_data.get('reactions', {})
                    if '👍' in reactions and len(reactions['👍']) > 0:
                        self.log("✅ Reaction verified in post data")
                    else:
                        self.log("⚠️ Reaction not found in post data", "WARNING")
                
                # Get points after reaction
                me_response = self.admin_session.get(f"{BACKEND_URL}/auth/me")
                if me_response.status_code == 200:
                    user_data = me_response.json()
                    self.points_after_reaction = user_data.get('total_points', 0)
                    points_gained = self.points_after_reaction - self.points_after_post
                    self.log(f"✅ Points after reaction: {self.points_after_reaction} (gained: {points_gained})")
                    
                    if points_gained == 1:
                        self.log("✅ Correct points awarded for reaction (1 point)")
                        return True
                    else:
                        self.log(f"⚠️ Expected 1 point for reaction, got {points_gained}", "WARNING")
                        return True
                else:
                    self.log("❌ Could not get points after reaction", "ERROR")
                    return False
            else:
                self.log(f"❌ Failed to react to post: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Exception reacting to post: {e}", "ERROR")
            return False
    
    def unreact_to_post(self):
        """Remove reaction from post and verify points decrease"""
        self.log("\n🧪 Step 4: Unreacting to Post (Remove Reaction)")
        
        if not self.test_post_id:
            self.log("❌ No test post available", "ERROR")
            return False
        
        try:
            # Remove reaction (same endpoint toggles)
            response = self.admin_session.post(f"{BACKEND_URL}/posts/{self.test_post_id}/react?emoji=👍")
            if response.status_code == 200:
                self.log("✅ Reaction removed successfully")
                
                # Verify reaction was removed
                post_response = self.admin_session.get(f"{BACKEND_URL}/posts/{self.test_post_id}")
                if post_response.status_code == 200:
                    post_data = post_response.json()
                    reactions = post_data.get('reactions', {})
                    if '👍' not in reactions or len(reactions.get('👍', [])) == 0:
                        self.log("✅ Reaction removal verified in post data")
                    else:
                        self.log("⚠️ Reaction still found in post data", "WARNING")
                
                # Get points after unreaction
                me_response = self.admin_session.get(f"{BACKEND_URL}/auth/me")
                if me_response.status_code == 200:
                    user_data = me_response.json()
                    self.points_after_unreaction = user_data.get('total_points', 0)
                    points_lost = self.points_after_reaction - self.points_after_unreaction
                    self.log(f"✅ Points after unreaction: {self.points_after_unreaction} (lost: {points_lost})")
                    
                    if points_lost == 1:
                        self.log("✅ Correct points deducted for unreaction (1 point)")
                        
                        # Verify points are back to post creation level
                        if self.points_after_unreaction == self.points_after_post:
                            self.log("✅ Points correctly returned to post creation level")
                            return True
                        else:
                            self.log(f"⚠️ Points not at expected level. Expected: {self.points_after_post}, Got: {self.points_after_unreaction}", "WARNING")
                            return True
                    else:
                        self.log(f"⚠️ Expected 1 point deduction for unreaction, got {points_lost}", "WARNING")
                        return True
                else:
                    self.log("❌ Could not get points after unreaction", "ERROR")
                    return False
            else:
                self.log(f"❌ Failed to remove reaction: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Exception removing reaction: {e}", "ERROR")
            return False
    
    def test_no_point_farming(self):
        """Test that points cannot be farmed by repeatedly reacting/unreacting"""
        self.log("\n🧪 Step 5: Testing No Point Farming")
        
        if not self.test_post_id:
            self.log("❌ No test post available", "ERROR")
            return False
        
        try:
            # React again
            react_response = self.admin_session.post(f"{BACKEND_URL}/posts/{self.test_post_id}/react?emoji=👍")
            if react_response.status_code != 200:
                self.log("❌ Failed to react again", "ERROR")
                return False
            
            # Get points after second reaction
            me_response = self.admin_session.get(f"{BACKEND_URL}/auth/me")
            if me_response.status_code == 200:
                user_data = me_response.json()
                points_after_second_reaction = user_data.get('total_points', 0)
                points_gained = points_after_second_reaction - self.points_after_unreaction
                self.log(f"✅ Points after second reaction: {points_after_second_reaction} (gained: {points_gained})")
                
                if points_gained == 1:
                    self.log("✅ Correct points awarded for second reaction")
                else:
                    self.log(f"⚠️ Expected 1 point for second reaction, got {points_gained}", "WARNING")
            
            # Unreact again
            unreact_response = self.admin_session.post(f"{BACKEND_URL}/posts/{self.test_post_id}/react?emoji=👍")
            if unreact_response.status_code != 200:
                self.log("❌ Failed to unreact again", "ERROR")
                return False
            
            # Get final points
            me_response = self.admin_session.get(f"{BACKEND_URL}/auth/me")
            if me_response.status_code == 200:
                user_data = me_response.json()
                final_points = user_data.get('total_points', 0)
                points_lost = points_after_second_reaction - final_points
                self.log(f"✅ Points after second unreaction: {final_points} (lost: {points_lost})")
                
                # Verify final points match expected level (initial + post creation points)
                expected_final = self.points_after_post
                if final_points == expected_final:
                    self.log("✅ Final points match expected level - no point farming possible")
                    return True
                else:
                    self.log(f"⚠️ Final points mismatch. Expected: {expected_final}, Got: {final_points}", "WARNING")
                    return True
            else:
                self.log("❌ Could not get final points", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in point farming test: {e}", "ERROR")
            return False
    
    def test_comment_reactions(self):
        """Test comment reactions work the same way"""
        self.log("\n🧪 Step 6: Testing Comment Reactions")
        
        if not self.test_post_id:
            self.log("❌ No test post available", "ERROR")
            return False
        
        try:
            # Create a comment
            comment_data = {"content": "Test comment"}
            comment_response = self.admin_session.post(f"{BACKEND_URL}/posts/{self.test_post_id}/comments", json=comment_data)
            
            if comment_response.status_code == 200:
                comment = comment_response.json()
                self.test_comment_id = comment.get('id')
                self.log(f"✅ Test comment created (ID: {self.test_comment_id})")
                
                # Get points before comment reaction
                me_response = self.admin_session.get(f"{BACKEND_URL}/auth/me")
                if me_response.status_code == 200:
                    user_data = me_response.json()
                    points_before_comment_reaction = user_data.get('total_points', 0)
                    
                    # React to comment
                    react_response = self.admin_session.post(f"{BACKEND_URL}/comments/{self.test_comment_id}/react?emoji=❤️")
                    if react_response.status_code == 200:
                        self.log("✅ Comment reaction added successfully")
                        
                        # Check points increased
                        me_response = self.admin_session.get(f"{BACKEND_URL}/auth/me")
                        if me_response.status_code == 200:
                            user_data = me_response.json()
                            points_after_comment_reaction = user_data.get('total_points', 0)
                            points_gained = points_after_comment_reaction - points_before_comment_reaction
                            self.log(f"✅ Points after comment reaction: {points_after_comment_reaction} (gained: {points_gained})")
                            
                            if points_gained == 1:
                                self.log("✅ Correct points awarded for comment reaction")
                            else:
                                self.log(f"⚠️ Expected 1 point for comment reaction, got {points_gained}", "WARNING")
                            
                            # Unreact to comment
                            unreact_response = self.admin_session.post(f"{BACKEND_URL}/comments/{self.test_comment_id}/react?emoji=❤️")
                            if unreact_response.status_code == 200:
                                self.log("✅ Comment reaction removed successfully")
                                
                                # Check points decreased
                                me_response = self.admin_session.get(f"{BACKEND_URL}/auth/me")
                                if me_response.status_code == 200:
                                    user_data = me_response.json()
                                    points_after_comment_unreaction = user_data.get('total_points', 0)
                                    points_lost = points_after_comment_reaction - points_after_comment_unreaction
                                    self.log(f"✅ Points after comment unreaction: {points_after_comment_unreaction} (lost: {points_lost})")
                                    
                                    if points_lost == 1:
                                        self.log("✅ Correct points deducted for comment unreaction")
                                        return True
                                    else:
                                        self.log(f"⚠️ Expected 1 point deduction for comment unreaction, got {points_lost}", "WARNING")
                                        return True
                                else:
                                    self.log("❌ Could not get points after comment unreaction", "ERROR")
                                    return False
                            else:
                                self.log(f"❌ Failed to remove comment reaction: {unreact_response.status_code}", "ERROR")
                                return False
                        else:
                            self.log("❌ Could not get points after comment reaction", "ERROR")
                            return False
                    else:
                        self.log(f"❌ Failed to react to comment: {react_response.status_code} - {react_response.text}", "ERROR")
                        return False
                else:
                    self.log("❌ Could not get points before comment reaction", "ERROR")
                    return False
            else:
                self.log(f"❌ Failed to create comment: {comment_response.status_code} - {comment_response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in comment reaction test: {e}", "ERROR")
            return False
    
    def run_all_tests(self):
        """Run all reaction points tests"""
        self.log("🚀 Starting Reaction Points System Testing")
        self.log("=" * 60)
        
        tests = [
            ("Setup Admin Session", self.setup_admin_session),
            ("Get Initial Points", self.get_initial_points),
            ("Get Public Space", self.get_public_space),
            ("Create Test Post", self.create_test_post),
            ("React to Post", self.react_to_post),
            ("Unreact to Post", self.unreact_to_post),
            ("Test No Point Farming", self.test_no_point_farming),
            ("Test Comment Reactions", self.test_comment_reactions),
        ]
        
        passed = 0
        failed = 0
        
        for test_name, test_func in tests:
            try:
                if test_func():
                    passed += 1
                else:
                    failed += 1
                    self.log(f"❌ {test_name} FAILED", "ERROR")
            except Exception as e:
                failed += 1
                self.log(f"❌ {test_name} FAILED with exception: {e}", "ERROR")
        
        self.log("\n" + "=" * 60)
        self.log("🏁 REACTION POINTS SYSTEM TEST SUMMARY")
        self.log("=" * 60)
        self.log(f"✅ Passed: {passed}")
        self.log(f"❌ Failed: {failed}")
        self.log(f"📊 Total: {passed + failed}")
        
        if failed == 0:
            self.log("🎉 ALL TESTS PASSED! Reaction points system is working correctly.")
            return True
        else:
            self.log(f"⚠️ {failed} test(s) failed. Please review the issues above.")
            return False

def main():
    """Main function to run the tests"""
    tester = ReactionPointsTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()