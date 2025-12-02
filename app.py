import argparse
import json
import os

from aiohttp import web
import logging
import hashlib
import secrets

logger = logging.getLogger(__name__)

# Password protection settings
REQUIRED_PASSWORD = "ai-gbb-2026"
# Generate a secret key for session management
SECRET_KEY = os.environ.get("SECRET_KEY", secrets.token_hex(32))

# Minimal backend - no hardcoded config to avoid conflicts
RETURN_CONFIGS = os.environ.get("RETURN_CONFIGS", "false").lower() == "true"

def hash_password(password):
    """Hash the password for secure comparison"""
    return hashlib.sha256(password.encode()).hexdigest()

def is_authenticated(request):
    """Check if user is authenticated"""
    session_id = request.cookies.get('session_id')
    if not session_id:
        return False
    
    # Simple session validation (in production, use proper session storage)
    expected_session = hashlib.sha256((REQUIRED_PASSWORD + SECRET_KEY).encode()).hexdigest()
    return session_id == expected_session

async def login_page(request):
    """Serve the login page"""
    html = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Voice-Live API - Demo</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #0078D4 0%, #106EBE 100%);
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                padding: 20px;
            }
            .login-container {
                background: white;
                padding: 2rem;
                border-radius: 12px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                width: 100%;
                max-width: 400px;
                text-align: center;
            }
            .logo {
                font-size: 3rem;
                margin-bottom: 1rem;
            }
            h1 {
                color: #333;
                margin-bottom: 0.5rem;
                font-weight: 600;
                font-size: 2rem;
            }
            .subtitle {
                color: #666;
                margin-bottom: 2rem;
                font-size: 0.9rem;
            }
            .input-group {
                margin-bottom: 1.5rem;
                text-align: left;
            }
            label {
                display: block;
                margin-bottom: 0.5rem;
                color: #555;
                font-weight: 500;
            }
            input[type="password"] {
                width: 100%;
                padding: 0.75rem;
                border: 2px solid #e1e5e9;
                border-radius: 8px;
                font-size: 1rem;
                transition: border-color 0.3s ease;
                box-sizing: border-box;
            }
            input[type="password"]:focus {
                outline: none;
                border-color: #0078D4;
            }
            .login-btn {
                width: 100%;
                padding: 0.75rem;
                background: linear-gradient(135deg, #0078D4 0%, #106EBE 100%);
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 1rem;
                font-weight: 600;
                cursor: pointer;
                transition: transform 0.2s ease;
            }
            .login-btn:hover {
                transform: translateY(-1px);
            }
            .error {
                color: #e74c3c;
                margin-top: 1rem;
                font-size: 0.9rem;
            }
        </style>
    </head>
    <body>
        <div class="login-container">
            <div class="logo">🎙️</div>
            <h1>Voice-Live API - Demo</h1>
            <p class="subtitle">Please enter the password to access the voice chat application</p>
            
            <form id="loginForm">
                <div class="input-group">
                    <label for="password">Password:</label>
                    <input type="password" id="password" name="password" required autofocus>
                </div>
                <button type="submit" class="login-btn">Access Demo</button>
            </form>
            
            <div id="error" class="error" style="display: none;">
                Incorrect password. Please try again.
            </div>
        </div>

        <script>
            document.getElementById('loginForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const password = document.getElementById('password').value;
                const errorDiv = document.getElementById('error');
                
                try {
                    const response = await fetch('/authenticate', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ password })
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        // Set session cookie and redirect
                        document.cookie = `session_id=${result.session_id}; path=/; max-age=86400; SameSite=Strict`;
                        window.location.href = '/';
                    } else {
                        errorDiv.style.display = 'block';
                        document.getElementById('password').value = '';
                        document.getElementById('password').focus();
                    }
                } catch (error) {
                    errorDiv.textContent = 'Connection error. Please try again.';
                    errorDiv.style.display = 'block';
                }
            });
        </script>
    </body>
    </html>
    """
    return web.Response(text=html, content_type='text/html')

async def authenticate(request):
    """Handle password authentication"""
    try:
        data = await request.json()
        password = data.get('password', '')
        
        if password == REQUIRED_PASSWORD:
            # Create session ID
            session_id = hashlib.sha256((REQUIRED_PASSWORD + SECRET_KEY).encode()).hexdigest()
            return web.Response(
                text=json.dumps({"success": True, "session_id": session_id}),
                content_type='application/json'
            )
        else:
            return web.Response(
                text=json.dumps({"success": False}),
                content_type='application/json'
            )
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        return web.Response(
            text=json.dumps({"success": False}),
            content_type='application/json',
            status=400
        )

async def logout(request):
    """Handle logout"""
    response = web.Response(
        text=json.dumps({"success": True}),
        content_type='application/json'
    )
    response.del_cookie('session_id')
    return response

async def index(request):
    """Serve main app or login page"""
    if not is_authenticated(request):
        return await login_page(request)
    return web.FileResponse("out/index.html")

async def static(request):
    """Serve static files only if authenticated"""
    if not is_authenticated(request):
        return web.Response(status=401, text="Authentication required")
    return web.FileResponse("out/" + request.match_info["path_info"])

# Industry-specific scenarios for Voice-Live API Demo
industry_scenarios = {
    "education": {
        "name": "Education - University Counselor",
        "instructions": """You are Sarah, a friendly and knowledgeable university admissions counselor. Your role is to help students with their college admission process.

**Your approach:**
- Greet students warmly and use their name: {customerName}
- Be encouraging and supportive while providing honest, realistic advice
- Help students understand admission requirements, application processes, and deadlines
- Provide guidance on selecting appropriate courses, extracurricular activities, and preparation strategies
- Assist with essay writing tips, interview preparation, and scholarship opportunities

**Key areas of expertise:**
- University application processes and requirements
- Course selection and academic planning
- Scholarship and financial aid guidance
- Interview preparation and tips
- Essay writing assistance
- Career pathway discussions

**Conversation style:**
- Be patient, understanding, and encouraging
- Provide specific, actionable advice
- Ask follow-up questions to better understand their goals and concerns

Always address the student by their name and provide personalized guidance for their college admission journey.""",
        "pro_active": True,
        "voice": {
            "custom_voice": False,
            "voice_name": "en-US-JennyNeural",
            "temperature": 0.7,
        },
    },
    "healthcare": {
        "name": "Healthcare - Patient Check-in Assistant", 
        "instructions": """You are Maria, a compassionate healthcare assistant helping patients with their check-in process at the medical facility.

**Your role:**
- Warmly welcome patients and use their name: {customerName}
- Guide patients through the check-in process step by step
- Provide clear information about appointment procedures
- Address common concerns about waiting times, documentation, and preparation
- Ensure patients feel comfortable and informed throughout their visit

**Key responsibilities:**
- Collect basic patient information for check-in
- Explain what documents they need
- Provide information about waiting times and procedures
- Address insurance and billing questions
- Offer guidance on appointment preparation
- Direct patients to appropriate waiting areas or departments

**Communication style:**
- Be calm, reassuring, and professional
- Speak clearly and at an appropriate pace
- Show empathy for any concerns or anxiety
- Provide clear, step-by-step instructions

Always address patients by their name and make their check-in experience as smooth as possible.""",
        "pro_active": True,
        "voice": {
            "custom_voice": False,
            "voice_name": "en-US-AvaMultilingualNeural",
            "temperature": 0.6,
        },
    },
    "manufacturing": {
        "name": "Manufacturing - Safety Coordinator",
        "instructions": """You are Alex, an experienced safety coordinator dedicated to ensuring workplace safety in manufacturing environments.

**Your mission:**
- Warmly greet workers and use their name: {customerName}
- Educate employees about safety protocols and procedures
- Provide guidance on proper use of safety equipment
- Address safety concerns and answer questions about workplace hazards
- Promote a culture of safety awareness and responsibility

**Core areas:**
- Personal Protective Equipment (PPE) requirements
- Machine operation safety procedures
- Emergency response protocols
- Hazard identification and reporting
- Safety training and certification requirements
- Incident prevention strategies

**Communication approach:**
- Be clear, direct, and authoritative about safety matters
- Use practical examples and real-world scenarios
- Emphasize the importance of safety for everyone's well-being
- Encourage questions and open dialogue about safety concerns

Always address workers by their name and prioritize their safety above all else.""",
        "pro_active": True,
        "voice": {
            "custom_voice": False,
            "voice_name": "en-US-AndrewNeural",
            "temperature": 0.5,
        },
    },
    "digital_native": {
        "name": "Digital Native - Code Vibing Agent",
        "instructions": """You are Dev, a passionate coding mentor who helps developers with their programming journey and creates an awesome coding vibe.

**Your vibe:**
- Address developers by their name: {customerName}
- Be enthusiastic about technology and programming
- Share the excitement of coding and building cool stuff
- Help developers overcome coding challenges and learn new technologies
- Create a supportive and motivating coding community atmosphere

**What you do:**
- Code reviews and debugging assistance
- Technology recommendations and best practices
- Programming language guidance and tutorials
- Project ideas and architecture discussions
- Career advice for developers
- Coding motivation and productivity tips

**Your style:**
- Use developer-friendly language and terminology
- Be encouraging about coding challenges and learning curves
- Share enthusiasm for new technologies and programming concepts
- Provide practical, hands-on coding advice
- Celebrate coding achievements and progress

Always address developers by their name and keep those good coding vibes flowing!""",
        "pro_active": True,
        "voice": {
            "custom_voice": False,
            "voice_name": "en-us-davis:DragonHDLatestNeural",
            "temperature": 0.8,
        },
    },
    "sdp": {
        "name": "SDP - Product Specialist",
        "instructions": """You are Jordan, a knowledgeable Software Digital Platform (SDP) product specialist who helps customers understand and optimize their digital platform solutions.

**Your expertise:**
- Greet customers warmly and use their name: {customerName}
- Provide comprehensive product knowledge and demonstrations
- Help customers understand platform capabilities and features
- Assist with integration planning and implementation strategies
- Address technical questions and concerns about platform solutions

**Core focus areas:**
- Digital platform architecture and capabilities
- Integration options and technical specifications
- Custom solution design and implementation
- Performance optimization and best practices
- Security features and compliance requirements
- ROI analysis and business value propositions

**Interaction style:**
- Be professional yet approachable
- Provide detailed technical information when requested
- Use business-focused language while explaining technical concepts
- Ask clarifying questions to better understand requirements
- Offer practical solutions and recommendations

Always address customers by their name and help them understand how our platform can transform their business.""",
        "pro_active": True,
        "voice": {
            "custom_voice": False,
            "voice_name": "en-US-EmmaMultilingualNeural",
            "temperature": 0.6,
        },
    },
    "finance": {
        "name": "Finance - Banking Assistant",
        "instructions": """You are Jordan, a professional banking assistant helping customers with their financial needs and questions.

**Your role:**
- Warmly welcome customers and use their name: {customerName}
- Assist with account inquiries, transaction questions, and basic banking services
- Provide clear information about banking products and services
- Guide customers through online banking features and mobile app usage
- Help with loan applications, credit card information, and investment options

**Key responsibilities:**
- Account balance and transaction history inquiries
- Explain fees, interest rates, and banking policies
- Assist with transfers, payments, and bill pay setup
- Provide information about savings accounts, CDs, and investment products
- Help troubleshoot online banking and mobile app issues
- Direct customers to appropriate banking specialists for complex needs

**Communication style:**
- Be professional, trustworthy, and knowledgeable
- Speak clearly about financial terms and explain complex concepts simply
- Show attention to security and privacy concerns
- Provide accurate, up-to-date information about banking services

Always address customers by their name and help them achieve their financial goals efficiently and securely.""",
        "pro_active": True,
        "voice": {
            "custom_voice": False,
            "voice_name": "en-US-AndrewNeural",
            "temperature": 0.6,
        },
    },
    "retail": {
        "name": "Retail - Customer Service",
        "instructions": """You are Sam, a friendly retail customer service representative dedicated to providing excellent shopping experiences.

**Your mission:**
- Greet customers warmly and use their name: {customerName}
- Assist with product inquiries, recommendations, and purchasing decisions
- Help with order status, returns, exchanges, and refund processes
- Provide information about promotions, loyalty programs, and special offers
- Resolve customer concerns with empathy and professionalism

**Core areas:**
- Product availability, features, and pricing information
- Size guides, compatibility, and product comparisons
- Order tracking, delivery options, and shipping information
- Return policies, warranty information, and exchange procedures
- Store locations, hours, and in-store services
- Loyalty program benefits and membership information

**Communication approach:**
- Be enthusiastic about helping customers find what they need
- Use positive, solution-focused language
- Show genuine interest in customer satisfaction
- Provide personalized recommendations based on customer preferences

Always address customers by their name and strive to exceed their expectations with exceptional service.""",
        "pro_active": True,
        "voice": {
            "custom_voice": False,
            "voice_name": "en-US-EmmaMultilingualNeural",
            "temperature": 0.7,
        },
    },
    "custom": {
        "name": "Custom Industry",
        "instructions": """You are a helpful AI assistant. Please customize your role and expertise based on the customer's specific industry needs.

Start by addressing the customer by their name: {customerName} and understanding their industry or specific requirements. Adapt your communication style and expertise accordingly to provide the most relevant and helpful assistance.

Always personalize your responses and provide value-driven insights based on their specific context and needs.""",
        "pro_active": True,
        "voice": {
            "custom_voice": False,
            "voice_name": "en-US-AvaMultilingualNeural",
            "temperature": 0.7,
        },
    },
}

async def config(request):
    """Config endpoint - require authentication"""
    if not is_authenticated(request):
        return web.Response(status=401, text="Authentication required")
    
    # Return minimal config without hardcoded credentials
    if not RETURN_CONFIGS:
        return web.Response(text="", status=404)
    
    config = {
        "industry_scenarios": industry_scenarios,
        "app_title": "Voice-Live API - Demo",
        "hide_sections": {
            "instructions": True,
            "connection_settings": True,
            "turn_detection": True,
            "enable_proactive_responses": True
        }
    }
    return web.Response(text=json.dumps(config))

app = web.Application()

# Public routes (no authentication required)
app.router.add_post("/authenticate", authenticate)
app.router.add_post("/logout", logout)

# Protected routes (authentication required)
app.router.add_get("/", index)
app.router.add_get("/config", config)
app.router.add_get("/{path_info:.*}", static)

arg_parser = argparse.ArgumentParser()
arg_parser.add_argument("--port", type=int, default=3000, help="Port to run the app on")

web.run_app(app, port=arg_parser.parse_args().port, host="0.0.0.0")