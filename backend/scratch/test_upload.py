import requests

BASE_URL = "http://127.0.0.1:8000"

def test_bulk_upload():
    # 1. Login to get session/cookies or token
    session = requests.Session()
    login_payload = {
        "username": "admin",
        "password": "adminpassword"
    }
    
    print("[*] Logging in as admin...")
    login_res = session.post(f"{BASE_URL}/api/auth/login", json=login_payload)
    if login_res.status_code != 200:
        print(f"[!] Login failed: {login_res.status_code} - {login_res.text}")
        return
        
    print("[+] Login successful!")
    
    # 2. Upload test_participants.csv
    file_path = r"c:\Users\samue\Desktop\Convocation\backend\test_participants.csv"
    print(f"[*] Uploading file: {file_path}")
    
    with open(file_path, "rb") as f:
        files = {
            "file": ( "test_participants.csv", f, "text/csv" )
        }
        upload_res = session.post(f"{BASE_URL}/api/admin/upload-participants", files=files)
        
    print(f"[*] Upload status code: {upload_res.status_code}")
    print(f"[*] Response content: {upload_res.text}")
    
    if upload_res.status_code == 200:
        print("[+] SUCCESS! Bulk upload verified.")
    else:
        print("[!] FAILED! Bulk upload returned error.")

if __name__ == "__main__":
    test_bulk_upload()
