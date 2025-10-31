#!/usr/bin/env python3
"""
Backend API Testing Script for Learning Space Section and Lesson Management System
Tests all endpoints for sections, lessons, and progress tracking
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BACKEND_URL = "https://collab-hub-48.preview.emergentagent.com/api"
ADMIN_EMAIL = "testadmin@abcd.com"
ADMIN_PASSWORD = "TestAdmin2025!"

# Global variables
session_token = None
admin_user = None
test_space_id = None
section1_id = None
section2_id = None
lesson1_id = None
lesson2_id = None
lesson3_id = None

def print_test(test_name):
    """Print test name"""
    print(f"\n{'='*80}")
    print(f"TEST: {test_name}")
    print(f"{'='*80}")

def print_success(message):
    """Print success message"""
    print(f"✅ SUCCESS: {message}")

def print_error(message):
    """Print error message"""
    print(f"❌ ERROR: {message}")

def print_info(message):
    """Print info message"""
    print(f"ℹ️  INFO: {message}")

def make_request(method, endpoint, data=None, expected_status=200, description=""):
    """Make HTTP request with error handling"""
    url = f"{BACKEND_URL}{endpoint}"
    headers = {
        "Content-Type": "application/json"
    }
    
    if session_token:
        headers["Authorization"] = f"Bearer {session_token}"
    
    try:
        if method == "GET":
            response = requests.get(url, headers=headers)
        elif method == "POST":
            response = requests.post(url, headers=headers, json=data)
        elif method == "PUT":
            response = requests.put(url, headers=headers, json=data)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers)
        else:
            print_error(f"Unsupported HTTP method: {method}")
            return None
        
        print_info(f"{method} {endpoint} - Status: {response.status_code}")
        
        if description:
            print_info(f"Description: {description}")
        
        if response.status_code != expected_status:
            print_error(f"Expected status {expected_status}, got {response.status_code}")
            print_error(f"Response: {response.text}")
            return None
        
        try:
            return response.json()
        except:
            return {"status": "success"}
    
    except Exception as e:
        print_error(f"Request failed: {str(e)}")
        return None

def test_admin_login():
    """Test 1: Admin Login"""
    global session_token, admin_user
    
    print_test("Admin Login")
    
    response = make_request(
        "POST",
        "/auth/login",
        {
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        },
        expected_status=200,
        description="Login as admin user"
    )
    
    if not response:
        print_error("Admin login failed")
        return False
    
    session_token = response.get("session_token")
    admin_user = response.get("user")
    
    if not session_token:
        print_error("No session token received")
        return False
    
    if admin_user.get("role") != "admin":
        print_error(f"User is not admin. Role: {admin_user.get('role')}")
        return False
    
    print_success(f"Admin logged in successfully: {admin_user.get('email')}")
    print_info(f"Session token: {session_token[:20]}...")
    return True

def test_create_learning_space():
    """Test 2: Create Learning Space"""
    global test_space_id
    
    print_test("Create Learning Space")
    
    # First, check if a learning space already exists
    response = make_request(
        "GET",
        "/spaces",
        expected_status=200,
        description="Get all spaces to check for existing learning space"
    )
    
    if response:
        spaces = response.get("spaces", [])
        for space in spaces:
            if space.get("space_type") == "learning":
                test_space_id = space.get("id")
                print_success(f"Found existing learning space: {space.get('name')} (ID: {test_space_id})")
                return True
    
    # Create new learning space if none exists
    space_name = f"Test Learning Space {datetime.now().strftime('%Y%m%d%H%M%S')}"
    response = make_request(
        "POST",
        "/spaces",
        {
            "name": space_name,
            "description": "Test learning space for section and lesson management",
            "space_type": "learning",
            "visibility": "public",
            "auto_join": False
        },
        expected_status=200,
        description="Create new learning space"
    )
    
    if not response:
        print_error("Failed to create learning space")
        return False
    
    test_space_id = response.get("id")
    print_success(f"Learning space created: {space_name} (ID: {test_space_id})")
    return True

def test_create_sections():
    """Test 3: Create Sections"""
    global section1_id, section2_id
    
    print_test("Create Sections")
    
    # Create Section 1: Introduction
    print_info("Creating Section 1: Introduction")
    response = make_request(
        "POST",
        f"/spaces/{test_space_id}/sections",
        {
            "name": "Introduction",
            "description": "Introduction to the course",
            "order": 1
        },
        expected_status=200,
        description="Create 'Introduction' section"
    )
    
    if not response:
        print_error("Failed to create Introduction section")
        return False
    
    section1_id = response.get("id")
    print_success(f"Section 1 created: Introduction (ID: {section1_id})")
    
    # Create Section 2: Advanced Topics
    print_info("Creating Section 2: Advanced Topics")
    response = make_request(
        "POST",
        f"/spaces/{test_space_id}/sections",
        {
            "name": "Advanced Topics",
            "description": "Advanced course content",
            "order": 2
        },
        expected_status=200,
        description="Create 'Advanced Topics' section"
    )
    
    if not response:
        print_error("Failed to create Advanced Topics section")
        return False
    
    section2_id = response.get("id")
    print_success(f"Section 2 created: Advanced Topics (ID: {section2_id})")
    
    return True

def test_get_sections():
    """Test 4: Get All Sections"""
    print_test("Get All Sections")
    
    response = make_request(
        "GET",
        f"/spaces/{test_space_id}/sections",
        expected_status=200,
        description="Retrieve all sections for the learning space"
    )
    
    if not response:
        print_error("Failed to get sections")
        return False
    
    if not isinstance(response, list):
        print_error(f"Expected list, got {type(response)}")
        return False
    
    if len(response) < 2:
        print_error(f"Expected at least 2 sections, got {len(response)}")
        return False
    
    print_success(f"Retrieved {len(response)} sections")
    for section in response:
        print_info(f"  - {section.get('name')} (ID: {section.get('id')}, Order: {section.get('order')}, Lessons: {section.get('lesson_count', 0)})")
    
    return True

def test_create_lessons():
    """Test 5: Create Lessons"""
    global lesson1_id, lesson2_id, lesson3_id
    
    print_test("Create Lessons")
    
    # Create Lesson 1 in Introduction section
    print_info("Creating Lesson 1 in Introduction section")
    response = make_request(
        "POST",
        f"/spaces/{test_space_id}/lessons",
        {
            "section_id": section1_id,
            "title": "Getting Started",
            "description": "Learn the basics and get started with the platform",
            "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "content": "<p>Welcome to the course! This lesson covers the fundamentals.</p>",
            "order": 1,
            "duration": 15
        },
        expected_status=200,
        description="Create lesson 1 in Introduction section"
    )
    
    if not response:
        print_error("Failed to create lesson 1")
        return False
    
    lesson1_id = response.get("id")
    print_success(f"Lesson 1 created: Getting Started (ID: {lesson1_id})")
    
    # Create Lesson 2 in Introduction section
    print_info("Creating Lesson 2 in Introduction section")
    response = make_request(
        "POST",
        f"/spaces/{test_space_id}/lessons",
        {
            "section_id": section1_id,
            "title": "Core Concepts",
            "description": "Understanding the core concepts",
            "video_url": "https://www.youtube.com/watch?v=9bZkp7q19f0",
            "content": "<p>In this lesson, we'll explore the core concepts you need to know.</p>",
            "order": 2,
            "duration": 20
        },
        expected_status=200,
        description="Create lesson 2 in Introduction section"
    )
    
    if not response:
        print_error("Failed to create lesson 2")
        return False
    
    lesson2_id = response.get("id")
    print_success(f"Lesson 2 created: Core Concepts (ID: {lesson2_id})")
    
    # Create Lesson 3 in Advanced Topics section
    print_info("Creating Lesson 3 in Advanced Topics section")
    response = make_request(
        "POST",
        f"/spaces/{test_space_id}/lessons",
        {
            "section_id": section2_id,
            "title": "Advanced Techniques",
            "description": "Master advanced techniques and best practices",
            "video_url": "https://www.youtube.com/watch?v=jNQXAC9IVRw",
            "content": "<p>This advanced lesson covers sophisticated techniques for experts.</p>",
            "order": 1,
            "duration": 30
        },
        expected_status=200,
        description="Create lesson 3 in Advanced Topics section"
    )
    
    if not response:
        print_error("Failed to create lesson 3")
        return False
    
    lesson3_id = response.get("id")
    print_success(f"Lesson 3 created: Advanced Techniques (ID: {lesson3_id})")
    
    return True

def test_get_lessons():
    """Test 6: Get All Lessons Grouped by Sections"""
    print_test("Get All Lessons Grouped by Sections")
    
    response = make_request(
        "GET",
        f"/spaces/{test_space_id}/lessons",
        expected_status=200,
        description="Retrieve all lessons grouped by sections"
    )
    
    if not response:
        print_error("Failed to get lessons")
        return False
    
    sections = response.get("sections", {})
    lessons = response.get("lessons", [])
    sections_list = response.get("sections_list", [])
    
    print_success(f"Retrieved {len(lessons)} total lessons")
    print_info(f"Sections: {list(sections.keys())}")
    
    for section_name, section_lessons in sections.items():
        print_info(f"  Section '{section_name}': {len(section_lessons)} lessons")
        for lesson in section_lessons:
            print_info(f"    - {lesson.get('title')} (ID: {lesson.get('id')}, Completed: {lesson.get('completed', False)})")
    
    # Verify we have lessons in both sections
    if "Introduction" not in sections or len(sections["Introduction"]) < 2:
        print_error("Expected at least 2 lessons in Introduction section")
        return False
    
    if "Advanced Topics" not in sections or len(sections["Advanced Topics"]) < 1:
        print_error("Expected at least 1 lesson in Advanced Topics section")
        return False
    
    return True

def test_get_specific_lesson():
    """Test 7: Get Specific Lesson with Progress"""
    print_test("Get Specific Lesson with Progress")
    
    response = make_request(
        "GET",
        f"/lessons/{lesson1_id}",
        expected_status=200,
        description=f"Get lesson details for lesson 1"
    )
    
    if not response:
        print_error("Failed to get lesson")
        return False
    
    if response.get("id") != lesson1_id:
        print_error(f"Expected lesson ID {lesson1_id}, got {response.get('id')}")
        return False
    
    print_success(f"Retrieved lesson: {response.get('title')}")
    print_info(f"  Description: {response.get('description')}")
    print_info(f"  Video URL: {response.get('video_url')}")
    print_info(f"  Duration: {response.get('duration')} minutes")
    
    progress = response.get("progress", {})
    print_info(f"  Progress: Completed={progress.get('completed', False)}, Watch%={progress.get('watch_percentage', 0)}")
    
    # Verify required fields
    required_fields = ["id", "title", "space_id", "section_id", "progress"]
    for field in required_fields:
        if field not in response:
            print_error(f"Missing required field: {field}")
            return False
    
    return True

def test_update_lesson_progress():
    """Test 8: Update Lesson Progress"""
    print_test("Update Lesson Progress")
    
    # Test 8a: Update watch percentage
    print_info("Test 8a: Update watch percentage to 50%")
    response = make_request(
        "POST",
        f"/lessons/{lesson1_id}/progress",
        {
            "watch_percentage": 50.0,
            "completed": False
        },
        expected_status=200,
        description="Update watch percentage to 50%"
    )
    
    if not response:
        print_error("Failed to update progress")
        return False
    
    print_success("Progress updated to 50%")
    
    # Test 8b: Mark lesson as complete
    print_info("Test 8b: Mark lesson as complete")
    response = make_request(
        "POST",
        f"/lessons/{lesson1_id}/progress",
        {
            "watch_percentage": 100.0,
            "completed": True
        },
        expected_status=200,
        description="Mark lesson as complete"
    )
    
    if not response:
        print_error("Failed to mark lesson as complete")
        return False
    
    if not response.get("completed"):
        print_error("Lesson not marked as completed")
        return False
    
    print_success("Lesson marked as complete")
    
    # Test 8c: Auto-complete at 80% watch
    print_info("Test 8c: Auto-complete at 80% watch percentage")
    response = make_request(
        "POST",
        f"/lessons/{lesson2_id}/progress",
        {
            "watch_percentage": 85.0
        },
        expected_status=200,
        description="Update watch percentage to 85% (should auto-complete)"
    )
    
    if not response:
        print_error("Failed to update progress")
        return False
    
    if not response.get("completed"):
        print_error("Lesson should auto-complete at 80%+ watch percentage")
        return False
    
    print_success("Lesson auto-completed at 85% watch percentage")
    
    return True

def test_get_progress_stats():
    """Test 9: Get Overall Progress Stats"""
    print_test("Get Overall Progress Stats")
    
    response = make_request(
        "GET",
        f"/spaces/{test_space_id}/my-progress",
        expected_status=200,
        description="Get overall progress statistics"
    )
    
    if not response:
        print_error("Failed to get progress stats")
        return False
    
    total_lessons = response.get("total_lessons", 0)
    completed_lessons = response.get("completed_lessons", 0)
    progress_percentage = response.get("progress_percentage", 0)
    
    print_success(f"Progress Stats Retrieved:")
    print_info(f"  Total Lessons: {total_lessons}")
    print_info(f"  Completed Lessons: {completed_lessons}")
    print_info(f"  Progress Percentage: {progress_percentage}%")
    
    # Verify we have completed at least 2 lessons (from previous tests)
    if completed_lessons < 2:
        print_error(f"Expected at least 2 completed lessons, got {completed_lessons}")
        return False
    
    # Verify progress percentage is calculated correctly
    expected_percentage = round((completed_lessons / total_lessons) * 100, 1)
    if abs(progress_percentage - expected_percentage) > 0.1:
        print_error(f"Progress percentage mismatch. Expected {expected_percentage}%, got {progress_percentage}%")
        return False
    
    return True

def test_update_lesson():
    """Test 10: Update Lesson"""
    print_test("Update Lesson")
    
    response = make_request(
        "PUT",
        f"/spaces/{test_space_id}/lessons/{lesson3_id}",
        {
            "title": "Advanced Techniques - Updated",
            "description": "Updated description for advanced techniques",
            "duration": 35
        },
        expected_status=200,
        description="Update lesson 3 title, description, and duration"
    )
    
    if not response:
        print_error("Failed to update lesson")
        return False
    
    print_success("Lesson updated successfully")
    
    # Verify the update
    print_info("Verifying lesson update...")
    verify_response = make_request(
        "GET",
        f"/lessons/{lesson3_id}",
        expected_status=200,
        description="Verify lesson was updated"
    )
    
    if not verify_response:
        print_error("Failed to verify lesson update")
        return False
    
    if verify_response.get("title") != "Advanced Techniques - Updated":
        print_error(f"Title not updated. Expected 'Advanced Techniques - Updated', got '{verify_response.get('title')}'")
        return False
    
    if verify_response.get("duration") != 35:
        print_error(f"Duration not updated. Expected 35, got {verify_response.get('duration')}")
        return False
    
    print_success("Lesson update verified")
    return True

def test_update_section():
    """Test 11: Update Section"""
    print_test("Update Section")
    
    response = make_request(
        "PUT",
        f"/spaces/{test_space_id}/sections/{section1_id}",
        {
            "name": "Introduction - Updated",
            "description": "Updated introduction section description"
        },
        expected_status=200,
        description="Update section 1 name and description"
    )
    
    if not response:
        print_error("Failed to update section")
        return False
    
    print_success("Section updated successfully")
    
    # Verify the update
    print_info("Verifying section update...")
    verify_response = make_request(
        "GET",
        f"/spaces/{test_space_id}/sections",
        expected_status=200,
        description="Verify section was updated"
    )
    
    if not verify_response:
        print_error("Failed to verify section update")
        return False
    
    section_found = False
    for section in verify_response:
        if section.get("id") == section1_id:
            section_found = True
            if section.get("name") != "Introduction - Updated":
                print_error(f"Section name not updated. Expected 'Introduction - Updated', got '{section.get('name')}'")
                return False
            break
    
    if not section_found:
        print_error("Updated section not found")
        return False
    
    print_success("Section update verified")
    return True

def test_delete_lesson():
    """Test 12: Delete Lesson"""
    print_test("Delete Lesson")
    
    # Delete lesson 3
    response = make_request(
        "DELETE",
        f"/spaces/{test_space_id}/lessons/{lesson3_id}",
        expected_status=200,
        description="Delete lesson 3"
    )
    
    if not response:
        print_error("Failed to delete lesson")
        return False
    
    print_success("Lesson deleted successfully")
    
    # Verify deletion
    print_info("Verifying lesson deletion...")
    verify_response = make_request(
        "GET",
        f"/lessons/{lesson3_id}",
        expected_status=404,
        description="Verify lesson was deleted (should return 404)"
    )
    
    # For 404, the response will be None (expected)
    if verify_response is not None:
        print_error("Lesson still exists after deletion")
        return False
    
    print_success("Lesson deletion verified")
    return True

def test_delete_section_moves_lessons():
    """Test 13: Delete Section (Lessons Move to Uncategorized)"""
    print_test("Delete Section - Lessons Move to Uncategorized")
    
    # First, get current lessons in section 1
    print_info("Getting lessons before section deletion...")
    before_response = make_request(
        "GET",
        f"/spaces/{test_space_id}/lessons",
        expected_status=200,
        description="Get lessons before section deletion"
    )
    
    if not before_response:
        print_error("Failed to get lessons before deletion")
        return False
    
    intro_lessons_before = before_response.get("sections", {}).get("Introduction - Updated", [])
    lesson_ids_in_section = [lesson.get("id") for lesson in intro_lessons_before]
    
    print_info(f"Found {len(intro_lessons_before)} lessons in 'Introduction - Updated' section")
    
    # Delete section 1
    print_info("Deleting section 1...")
    response = make_request(
        "DELETE",
        f"/spaces/{test_space_id}/sections/{section1_id}",
        expected_status=200,
        description="Delete section 1 (Introduction - Updated)"
    )
    
    if not response:
        print_error("Failed to delete section")
        return False
    
    print_success("Section deleted successfully")
    
    # Verify lessons moved to Uncategorized
    print_info("Verifying lessons moved to Uncategorized...")
    after_response = make_request(
        "GET",
        f"/spaces/{test_space_id}/lessons",
        expected_status=200,
        description="Get lessons after section deletion"
    )
    
    if not after_response:
        print_error("Failed to get lessons after deletion")
        return False
    
    uncategorized_lessons = after_response.get("sections", {}).get("Uncategorized", [])
    
    print_info(f"Found {len(uncategorized_lessons)} lessons in 'Uncategorized' section")
    
    # Check if the lessons from deleted section are now in Uncategorized
    uncategorized_ids = [lesson.get("id") for lesson in uncategorized_lessons]
    
    lessons_moved = all(lesson_id in uncategorized_ids for lesson_id in lesson_ids_in_section)
    
    if not lessons_moved:
        print_error("Not all lessons moved to Uncategorized")
        print_info(f"Expected lesson IDs: {lesson_ids_in_section}")
        print_info(f"Uncategorized lesson IDs: {uncategorized_ids}")
        return False
    
    print_success(f"All {len(lesson_ids_in_section)} lessons moved to Uncategorized")
    
    # Verify section no longer exists
    print_info("Verifying section no longer exists...")
    sections_response = make_request(
        "GET",
        f"/spaces/{test_space_id}/sections",
        expected_status=200,
        description="Verify section was deleted"
    )
    
    if not sections_response:
        print_error("Failed to get sections")
        return False
    
    for section in sections_response:
        if section.get("id") == section1_id:
            print_error("Deleted section still exists")
            return False
    
    print_success("Section deletion verified")
    return True

def test_admin_only_access():
    """Test 14: Admin-Only Access Control"""
    print_test("Admin-Only Access Control")
    
    # This test would require creating a non-admin user and testing access
    # For now, we'll just verify that endpoints require authentication
    
    print_info("Testing unauthenticated access...")
    
    # Save current token
    saved_token = session_token
    
    # Clear token to test unauthenticated access
    import backend_test
    backend_test.session_token = None
    
    # Try to create a section without auth
    response = make_request(
        "POST",
        f"/spaces/{test_space_id}/sections",
        {
            "name": "Unauthorized Section",
            "description": "This should fail"
        },
        expected_status=401,
        description="Attempt to create section without authentication (should fail)"
    )
    
    # Restore token
    backend_test.session_token = saved_token
    
    if response is not None:
        print_error("Unauthenticated request should have failed")
        return False
    
    print_success("Unauthenticated access properly rejected")
    return True

def run_all_tests():
    """Run all tests in sequence"""
    print("\n" + "="*80)
    print("LEARNING SPACE SECTION AND LESSON MANAGEMENT SYSTEM - BACKEND API TESTS")
    print("="*80)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Admin Email: {ADMIN_EMAIL}")
    print(f"Test Start Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)
    
    tests = [
        ("Admin Login", test_admin_login),
        ("Create Learning Space", test_create_learning_space),
        ("Create Sections", test_create_sections),
        ("Get All Sections", test_get_sections),
        ("Create Lessons", test_create_lessons),
        ("Get All Lessons Grouped by Sections", test_get_lessons),
        ("Get Specific Lesson with Progress", test_get_specific_lesson),
        ("Update Lesson Progress", test_update_lesson_progress),
        ("Get Overall Progress Stats", test_get_progress_stats),
        ("Update Lesson", test_update_lesson),
        ("Update Section", test_update_section),
        ("Delete Lesson", test_delete_lesson),
        ("Delete Section - Lessons Move to Uncategorized", test_delete_section_moves_lessons),
        ("Admin-Only Access Control", test_admin_only_access),
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            if result:
                passed += 1
            else:
                failed += 1
                print_error(f"Test '{test_name}' FAILED")
        except Exception as e:
            failed += 1
            print_error(f"Test '{test_name}' FAILED with exception: {str(e)}")
            import traceback
            traceback.print_exc()
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print(f"Total Tests: {passed + failed}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"Success Rate: {(passed / (passed + failed) * 100):.1f}%")
    print(f"Test End Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)
    
    return failed == 0

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
