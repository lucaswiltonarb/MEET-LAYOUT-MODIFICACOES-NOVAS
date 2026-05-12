"""
Backend API Tests for Moogle Meet (Google Meet Clone)
Tests the FastAPI proxy server and Next.js API routes
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthEndpoint:
    """Health check endpoint tests"""
    
    def test_health_returns_200(self):
        """Test /api/health returns 200 with proxy info"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        
        data = response.json()
        assert "status" in data
        assert data["status"] == "ok"
        assert "proxy_target" in data
        print(f"Health check passed: {data}")


class TestTokenEndpoint:
    """Token generation endpoint tests"""
    
    def test_token_post_success(self):
        """Test /api/token POST generates video and chat tokens"""
        response = requests.post(
            f"{BASE_URL}/api/token",
            json={"userId": "test-user-123"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "userId" in data
        assert data["userId"] == "test-user-123"
        assert "token" in data
        assert "videoToken" in data
        assert "chatToken" in data
        assert len(data["token"]) > 0
        assert len(data["videoToken"]) > 0
        assert len(data["chatToken"]) > 0
        print(f"Token generation passed: userId={data['userId']}")
    
    def test_token_post_missing_userid(self):
        """Test /api/token POST returns 400 when userId is missing"""
        response = requests.post(
            f"{BASE_URL}/api/token",
            json={},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400
        
        data = response.json()
        assert "error" in data
        print(f"Token validation passed: {data}")


class TestMeetingFakesEndpoint:
    """Meeting fakes endpoint tests"""
    
    def test_meeting_fakes_returns_array(self):
        """Test /api/meeting-fakes?meetingId=test returns fakes array"""
        response = requests.get(f"{BASE_URL}/api/meeting-fakes?meetingId=test")
        assert response.status_code == 200
        
        data = response.json()
        assert "fakes" in data
        assert isinstance(data["fakes"], list)
        print(f"Meeting fakes passed: {len(data['fakes'])} fakes found")
    
    def test_meeting_fakes_no_meetingid(self):
        """Test /api/meeting-fakes without meetingId returns empty array"""
        response = requests.get(f"{BASE_URL}/api/meeting-fakes")
        assert response.status_code == 200
        
        data = response.json()
        assert "fakes" in data
        assert data["fakes"] == []
        print("Meeting fakes without meetingId passed: empty array returned")


class TestPageRoutes:
    """Test that main page routes return 200"""
    
    def test_homepage_loads(self):
        """Test homepage / returns 200"""
        response = requests.get(f"{BASE_URL}/")
        assert response.status_code == 200
        print("Homepage loads successfully")
    
    def test_signin_page_loads(self):
        """Test /sign-in page returns 200"""
        response = requests.get(f"{BASE_URL}/sign-in")
        assert response.status_code == 200
        print("Sign-in page loads successfully")
    
    def test_signup_page_loads(self):
        """Test /sign-up page returns 200"""
        response = requests.get(f"{BASE_URL}/sign-up")
        assert response.status_code == 200
        print("Sign-up page loads successfully")
    
    def test_admin_page_loads(self):
        """Test /admin page returns 200"""
        response = requests.get(f"{BASE_URL}/admin")
        assert response.status_code == 200
        print("Admin page loads successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
