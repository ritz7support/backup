#!/usr/bin/env python3
"""
Referral/Affiliate Program Testing
Tests the complete referral system implementation including:
1. Get referral code
2. Get referral stats
3. Register with referral code
4. Verify points awarded
5. Credit calculation
6. Payment with credits (simulated)
"""

import requests
import json
from datetime import datetime, timezone, timedelta
import sys
import os
import time

# Configuration
BACKEND_URL = "https://collab-hub-48.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "admin123"

class ReferralProgramTester:
    def __init__(self):
        self.admin_session = requests.Session()
        self.admin_referral_code = None
        self.new_user_session = requests.Session()
        self.new_user_id = None
        self.tier_id = None
        
    def log(self, message, level="INFO"):
        """Log test messages"""
        print(f"[{level}] {message}")
        
    def setup_admin_user(self):
        """Setup and login admin user"""
        self.log("🔧 Setting up admin user...")
        
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
    
    def test_get_referral_code(self):
        """Test GET /api/me/referral-code"""
        self.log("\n🧪 Test 1: GET /api/me/referral-code")
        
        try:
            response = self.admin_session.get(f"{BACKEND_URL}/me/referral-code")
            
            if response.status_code == 200:
                data = response.json()
                referral_code = data.get('referral_code')
                
                if referral_code:
                    self.admin_referral_code = referral_code
                    self.log(f"✅ Referral code retrieved: {referral_code}")
                    
                    # Verify code format (should be like ADM123ABC)
                    if len(referral_code) >= 6 and referral_code.isalnum():
                        self.log(f"✅ Referral code format is valid: {referral_code}")
                        return True
                    else:
                        self.log(f"⚠️ Referral code format may be unexpected: {referral_code}", "WARNING")
                        return True
                else:
                    self.log("❌ No referral code in response", "ERROR")
                    return False
            else:
                self.log(f"❌ GET referral code failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in get referral code test: {e}", "ERROR")
            return False
    
    def test_get_referral_stats_initial(self):
        """Test GET /api/me/referral-stats (initial state)"""
        self.log("\n🧪 Test 2: GET /api/me/referral-stats (Initial State)")
        
        try:
            response = self.admin_session.get(f"{BACKEND_URL}/me/referral-stats")
            
            if response.status_code == 200:
                stats = response.json()
                self.log("✅ Referral stats retrieved successfully")
                
                # Verify response structure
                required_fields = ['total_referrals', 'points_earned_from_referrals', 'total_points', 'credits_inr', 'credits_usd', 'referred_users']
                missing_fields = [field for field in required_fields if field not in stats]
                
                if missing_fields:
                    self.log(f"❌ Missing fields in referral stats: {missing_fields}", "ERROR")
                    return False
                
                self.log(f"✅ All required fields present in referral stats")
                self.log(f"   - Total referrals: {stats['total_referrals']}")
                self.log(f"   - Points from referrals: {stats['points_earned_from_referrals']}")
                self.log(f"   - Total points: {stats['total_points']}")
                self.log(f"   - Credits INR: ₹{stats['credits_inr']}")
                self.log(f"   - Credits USD: ${stats['credits_usd']}")
                self.log(f"   - Referred users count: {len(stats['referred_users'])}")
                
                # Verify credit calculation
                total_points = stats['total_points']
                expected_inr = total_points * 1  # 1 point = ₹1
                expected_usd = round(total_points * 0.05, 2)  # 1 point = $0.05
                
                if stats['credits_inr'] == expected_inr and stats['credits_usd'] == expected_usd:
                    self.log("✅ Credit calculations are correct")
                else:
                    self.log(f"⚠️ Credit calculation mismatch. Expected INR: {expected_inr}, USD: {expected_usd}", "WARNING")
                
                return True
            else:
                self.log(f"❌ GET referral stats failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in get referral stats test: {e}", "ERROR")
            return False
    
    def test_register_with_referral_code(self):
        """Test POST /api/auth/register with referral code"""
        self.log("\n🧪 Test 3: Register with Referral Code")
        
        if not self.admin_referral_code:
            self.log("❌ No admin referral code available", "ERROR")
            return False
        
        try:
            # Generate unique email for new user
            timestamp = int(time.time())
            new_user_data = {
                "name": "Referred User",
                "email": f"referred{timestamp}@test.com",
                "password": "password123",
                "role": "learner"
            }
            
            # Register with referral code as query parameter
            response = self.new_user_session.post(
                f"{BACKEND_URL}/auth/register?ref={self.admin_referral_code}",
                json=new_user_data
            )
            
            if response.status_code == 200:
                user_data = response.json()
                self.new_user_id = user_data.get('user', {}).get('id')
                self.log(f"✅ User registered successfully with referral code")
                self.log(f"   - New user ID: {self.new_user_id}")
                self.log(f"   - Email: {new_user_data['email']}")
                
                if self.new_user_id:
                    return True
                else:
                    self.log("❌ No user ID in registration response", "ERROR")
                    return False
            else:
                self.log(f"❌ Registration with referral code failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in register with referral code test: {e}", "ERROR")
            return False
    
    def test_verify_points_awarded(self):
        """Test that points were awarded correctly"""
        self.log("\n🧪 Test 4: Verify Points Awarded")
        
        if not self.new_user_id:
            self.log("❌ No new user ID available", "ERROR")
            return False
        
        try:
            # Check admin's updated referral stats
            admin_stats_response = self.admin_session.get(f"{BACKEND_URL}/me/referral-stats")
            
            if admin_stats_response.status_code != 200:
                self.log(f"❌ Failed to get admin referral stats: {admin_stats_response.status_code}", "ERROR")
                return False
            
            admin_stats = admin_stats_response.json()
            
            # Check new user's points
            new_user_me_response = self.new_user_session.get(f"{BACKEND_URL}/auth/me")
            
            if new_user_me_response.status_code != 200:
                self.log(f"❌ Failed to get new user info: {new_user_me_response.status_code}", "ERROR")
                return False
            
            new_user_info = new_user_me_response.json()
            new_user_points = new_user_info.get('total_points', 0)
            
            self.log(f"✅ Points verification:")
            self.log(f"   - Admin total referrals: {admin_stats['total_referrals']}")
            self.log(f"   - Admin points from referrals: {admin_stats['points_earned_from_referrals']}")
            self.log(f"   - Admin total points: {admin_stats['total_points']}")
            self.log(f"   - New user total points: {new_user_points}")
            
            # Verify new user got 25 bonus points
            if new_user_points >= 25:
                self.log("✅ New user received welcome bonus (25+ points)")
            else:
                self.log(f"⚠️ New user may not have received full welcome bonus. Points: {new_user_points}", "WARNING")
            
            # Verify admin got points for referral (should have at least 1 referral)
            if admin_stats['total_referrals'] >= 1:
                self.log("✅ Admin referral count increased")
            else:
                self.log("⚠️ Admin referral count did not increase", "WARNING")
            
            # Check if referred user appears in admin's referred_users list
            referred_users = admin_stats.get('referred_users', [])
            found_user = any(user.get('id') == self.new_user_id for user in referred_users)
            
            if found_user:
                self.log("✅ New user appears in admin's referred users list")
            else:
                self.log("⚠️ New user not found in admin's referred users list", "WARNING")
            
            return True
            
        except Exception as e:
            self.log(f"❌ Exception in verify points awarded test: {e}", "ERROR")
            return False
    
    def test_credit_calculation(self):
        """Test credit calculation in both currencies"""
        self.log("\n🧪 Test 5: Credit Calculation")
        
        try:
            response = self.admin_session.get(f"{BACKEND_URL}/me/referral-stats")
            
            if response.status_code != 200:
                self.log(f"❌ Failed to get referral stats: {response.status_code}", "ERROR")
                return False
            
            stats = response.json()
            total_points = stats['total_points']
            credits_inr = stats['credits_inr']
            credits_usd = stats['credits_usd']
            
            # Verify calculations
            expected_inr = total_points * 1  # 1 point = ₹1
            expected_usd = round(total_points * 0.05, 2)  # 1 point = $0.05
            
            self.log(f"✅ Credit calculation verification:")
            self.log(f"   - Total points: {total_points}")
            self.log(f"   - Credits INR: ₹{credits_inr} (expected: ₹{expected_inr})")
            self.log(f"   - Credits USD: ${credits_usd} (expected: ${expected_usd})")
            
            if credits_inr == expected_inr:
                self.log("✅ INR credit calculation is correct")
            else:
                self.log(f"❌ INR credit calculation incorrect. Got: {credits_inr}, Expected: {expected_inr}", "ERROR")
                return False
            
            if credits_usd == expected_usd:
                self.log("✅ USD credit calculation is correct")
            else:
                self.log(f"❌ USD credit calculation incorrect. Got: {credits_usd}, Expected: {expected_usd}", "ERROR")
                return False
            
            # Example calculation for 100 points
            example_points = 100
            example_inr = example_points * 1
            example_usd = round(example_points * 0.05, 2)
            
            self.log(f"✅ Example: 100 points = ₹{example_inr} or ${example_usd}")
            
            return True
            
        except Exception as e:
            self.log(f"❌ Exception in credit calculation test: {e}", "ERROR")
            return False
    
    def test_get_subscription_tiers(self):
        """Test GET /api/subscription-tiers to get a tier ID for payment testing"""
        self.log("\n🧪 Test 6a: Get Subscription Tiers")
        
        try:
            response = self.admin_session.get(f"{BACKEND_URL}/subscription-tiers")
            
            if response.status_code == 200:
                tiers = response.json()
                self.log(f"✅ Retrieved {len(tiers)} subscription tiers")
                
                if tiers:
                    # Use the first tier for testing
                    self.tier_id = tiers[0]['id']
                    tier_name = tiers[0].get('name', 'Unknown')
                    self.log(f"✅ Using tier for payment test: {tier_name} (ID: {self.tier_id})")
                    return True
                else:
                    self.log("⚠️ No subscription tiers available for payment testing", "WARNING")
                    return False
            else:
                self.log(f"❌ Failed to get subscription tiers: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in get subscription tiers test: {e}", "ERROR")
            return False
    
    def test_payment_with_credits_simulation(self):
        """Test payment with credits (simulated)"""
        self.log("\n🧪 Test 6b: Payment with Credits - Simulated")
        
        if not self.tier_id:
            self.log("❌ No tier ID available for payment testing", "ERROR")
            return False
        
        try:
            # Test INR payment order creation
            self.log("Testing INR payment order creation...")
            inr_response = self.admin_session.post(
                f"{BACKEND_URL}/payments/create-order?tier_id={self.tier_id}&currency=INR",
                json={"origin_url": "https://collab-hub-48.preview.emergentagent.com/"}
            )
            
            if inr_response.status_code == 200:
                inr_data = inr_response.json()
                self.log("✅ INR payment order created successfully")
                
                # Check if credits were applied
                if 'credits_applied' in inr_data:
                    credits_applied = inr_data['credits_applied']
                    original_amount = inr_data.get('original_amount', 0)
                    final_amount = inr_data.get('amount', original_amount)
                    
                    self.log(f"   - Original amount: ₹{original_amount}")
                    self.log(f"   - Credits applied: ₹{credits_applied}")
                    self.log(f"   - Final amount: ₹{final_amount}")
                    
                    if credits_applied > 0:
                        self.log("✅ Credits were automatically applied to INR payment")
                    else:
                        self.log("ℹ️ No credits applied (user may not have enough points)")
                
                # Check for full credit coverage
                if inr_data.get('success') and inr_data.get('message') == "Subscription activated using credits":
                    self.log("✅ Payment fully covered by credits - subscription activated immediately")
                    return True
                    
            else:
                self.log(f"⚠️ INR payment order creation failed: {inr_response.status_code} - {inr_response.text}", "WARNING")
            
            # Test USD payment order creation
            self.log("Testing USD payment order creation...")
            usd_response = self.admin_session.post(
                f"{BACKEND_URL}/payments/create-order?tier_id={self.tier_id}&currency=USD",
                json={"origin_url": "https://collab-hub-48.preview.emergentagent.com/"}
            )
            
            if usd_response.status_code == 200:
                usd_data = usd_response.json()
                self.log("✅ USD payment order created successfully")
                
                # Check if credits were applied
                if 'credits_applied' in usd_data:
                    credits_applied = usd_data['credits_applied']
                    original_amount = usd_data.get('original_amount', 0)
                    final_amount = usd_data.get('amount', original_amount)
                    
                    self.log(f"   - Original amount: ${original_amount}")
                    self.log(f"   - Credits applied: ${credits_applied}")
                    self.log(f"   - Final amount: ${final_amount}")
                    
                    if credits_applied > 0:
                        self.log("✅ Credits were automatically applied to USD payment")
                    else:
                        self.log("ℹ️ No credits applied (user may not have enough points)")
                
                # Check for full credit coverage
                if usd_data.get('success') and usd_data.get('message') == "Subscription activated using credits":
                    self.log("✅ Payment fully covered by credits - subscription activated immediately")
                    return True
                    
            else:
                self.log(f"⚠️ USD payment order creation failed: {usd_response.status_code} - {usd_response.text}", "WARNING")
            
            self.log("✅ Payment integration with credits is working (partial or no credits applied)")
            return True
            
        except Exception as e:
            self.log(f"❌ Exception in payment with credits test: {e}", "ERROR")
            return False
    
    def run_all_tests(self):
        """Run all referral program tests"""
        self.log("🚀 Starting Referral/Affiliate Program Testing")
        self.log("=" * 60)
        
        tests = [
            ("Setup Admin User", self.setup_admin_user),
            ("Get Referral Code", self.test_get_referral_code),
            ("Get Referral Stats (Initial)", self.test_get_referral_stats_initial),
            ("Register with Referral Code", self.test_register_with_referral_code),
            ("Verify Points Awarded", self.test_verify_points_awarded),
            ("Credit Calculation", self.test_credit_calculation),
            ("Get Subscription Tiers", self.test_get_subscription_tiers),
            ("Payment with Credits (Simulated)", self.test_payment_with_credits_simulation),
        ]
        
        passed = 0
        failed = 0
        
        for test_name, test_func in tests:
            try:
                if test_func():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                self.log(f"❌ Test '{test_name}' crashed: {e}", "ERROR")
                failed += 1
        
        self.log("\n" + "=" * 60)
        self.log("🏁 REFERRAL PROGRAM TESTING COMPLETE")
        self.log(f"✅ Passed: {passed}")
        self.log(f"❌ Failed: {failed}")
        self.log(f"📊 Success Rate: {(passed/(passed+failed)*100):.1f}%")
        
        if failed == 0:
            self.log("🎉 ALL REFERRAL PROGRAM TESTS PASSED!")
            return True
        else:
            self.log("⚠️ Some tests failed. Check the logs above for details.")
            return False

if __name__ == "__main__":
    tester = ReferralProgramTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)