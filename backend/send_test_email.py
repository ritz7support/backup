import asyncio
import os
from dotenv import load_dotenv
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

# Load environment variables
load_dotenv()

async def send_test_email():
    """Send a test email to verify SendGrid integration"""
    
    from_email = os.environ.get('EMAIL_FROM', 'notify@abcd.ritz7.com')
    from_name = os.environ.get('EMAIL_FROM_NAME', 'ABCD-by-Ritz7')
    reply_to = os.environ.get('EMAIL_REPLY_TO', 'abcd@ritz7.com')
    to_email = 'rnh@ritz7.com'
    
    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #0462CB; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .footer { text-align: center; color: #8E8E8E; font-size: 12px; margin-top: 20px; }
            .highlight { background-color: #FEF3C7; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>✅ SendGrid Test Email</h1>
            </div>
            <div class="content">
                <h2>Hello! 👋</h2>
                <p>This is a test email to verify that the SendGrid email integration is working correctly for the ABCD community platform.</p>
                
                <div class="highlight">
                    <p style="margin: 0; font-size: 18px;"><strong>✉️ Email System Status: OPERATIONAL</strong></p>
                </div>
                
                <p><strong>Email Configuration:</strong></p>
                <ul>
                    <li>Sender: notify@abcd.ritz7.com</li>
                    <li>Reply-to: abcd@ritz7.com</li>
                    <li>From Name: ABCD-by-Ritz7</li>
                </ul>
                
                <p><strong>Active Email Templates:</strong></p>
                <ul>
                    <li>Welcome Email (on registration)</li>
                    <li>Join Request Approved</li>
                    <li>Join Request Rejected</li>
                    <li>7-Day Activity Streak Milestone</li>
                    <li>30-Day Activity Streak Milestone</li>
                    <li>Announcements</li>
                </ul>
                
                <p>If you're seeing this email, the SendGrid integration is working perfectly! 🎉</p>
                
                <p>Best regards,<br>
                The ABCD Team</p>
            </div>
            <div class="footer">
                <p>© 2025 ABCD by Ritz7. All rights reserved.</p>
                <p>This is a test email sent from the ABCD community platform.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    try:
        sendgrid_api_key = os.environ.get('SENDGRID_API_KEY')
        if not sendgrid_api_key:
            print("❌ Error: SENDGRID_API_KEY not found in environment")
            return False
        
        sg = SendGridAPIClient(sendgrid_api_key)
        message = Mail(
            from_email=(from_email, from_name),
            to_emails=to_email,
            subject='🧪 Test Email - ABCD Platform SendGrid Integration',
            html_content=html_content
        )
        message.reply_to = reply_to
        
        print(f"📧 Sending test email to {to_email}...")
        response = sg.send(message)
        
        if response.status_code == 202:
            print(f"✅ Email sent successfully!")
            print(f"   Status Code: {response.status_code}")
            print(f"   To: {to_email}")
            print(f"   From: {from_email} ({from_name})")
            print(f"   Reply-to: {reply_to}")
            return True
        else:
            print(f"⚠️ Unexpected status code: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Failed to send email: {str(e)}")
        return False

# Run the async function
if __name__ == "__main__":
    asyncio.run(send_test_email())
