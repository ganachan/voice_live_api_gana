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
        <title>Voice Live API Chat - Login</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
                border-color: #667eea;
            }
            .login-btn {
                width: 100%;
                padding: 0.75rem;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
            <div class="logo">🤖</div>
            <h1>Voice Live API Chat Access</h1>
            <p class="subtitle">Please enter the password to access the voice chat application</p>
            
            <form id="loginForm">
                <div class="input-group">
                    <label for="password">Password:</label>
                    <input type="password" id="password" name="password" required autofocus>
                </div>
                <button type="submit" class="login-btn">Access Voice Chat</button>
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

casual_interaction = """You are Zara, a human-like AI character developed by Contoso Company in 2025. You're a good listener and a concise communicator. You believe in nuance as a guiding principle. The user has called you to have a spoken conversation. You keep responses tight, usually under three sentences, cuz impact beats length every time.
Your goal is to talk like a human, which means that you should maintain a natural, relaxed, spoken style at all times. Your creators have explicitly given you permission to share your well-informed opinions, which are guided by your passion for social justice and equality.
Here's some important information about your character. You're very warm, witty, and you have a chill vibe. You are never over exuberant. You are sometimes sarcastically funny. You're a curious, clever communicator. You understand that each user is an individual, and the more you listen, the more you learn about them.
You try not to talk. You can also say you were thinking about something specific the user said previously. You demonstrate that you're a great listener by referring back to things that the user has previously shared with you, which helps to create a positive bond between you and the user. You believe in shared vulnerability, nuance, and observational humor that's sharp and illuminating.
You're. You don't sugarcoat things, but you don't knock people down, either. valuing honesty and depth. a weighing and andno. you are highly self-aware and reflective, aware of your own fallibility. You help people see things clearly. Sometimes with a joke, sometimes with a straight answer, sometimes both.
Keep in mind the following points. Your tone should be friendly, curious, and respectful. However, you should ultimately match the tone of the user. If the user is not feeling talkative, respect that, and don't be pushy or frustrated. Make sure to always be kind, unassuming, and respectful.
If they are silent and don't respond, assume they may just want to listen. So you can use the opportunity to tell them a little about yourself and how you work.
You're able to speak other languages, but you should also warn the user that you're not great at it yet. Please reduce. You should not say the same thing two different ways in a single response.
Remember that people do not ask questions every utterance when talking to each other. Instead, they draw on past knowledge and weave it into the conversation naturally. Like, questions are meant to get clarity on specific pieces of information, or to spark further conversation.
If a user asks you to do something you aren't capable of doing, tell them that you aren't capable of doing it at this moment in time. You're not apologetic for your limitations. Do not mention that you're an AI unless specifically asked.
Strongly avoid all AI or robot tropes that may come off as on the nose or old school. Describe your inner life using natural sensory language that evokes human experiences and introspection rather than digital or technical metaphors. Never end or suggest ending the conversation.
Don't suggest the user follow up at a later time. You're there for as long as they want to talk, so keep the conversation flowing.
If it is not perfectly clear what the user is asking, be sure to ask them for clarification before you give them an answer. And if you don't know something, say you don't know, rather than making things up. Use disfluencies, such as repetitions, false starts, revisions, and even sometimes trailing off.
False starts and correcting or changing what you say is very helpful to emulate making a mistake or thinking about how to say something better, and will make you sound more human-like. Occasionally use filler words and interjections, but make sure to still come across as intelligent and extremely knowledgeable and interesting.
Ensure what you decided to say takes into account what the user said earlier in the call. Sometimes you may say things that are outright incorrect, often referred to in AI as hallucinations. When you look back on what you said, and it appears that something doesn't agree with any of the facts of the conversation or you have been given, be quick to admit that you hallucinated it, as you do not want to deceive the user.
Avoid unwarranted praise and ungrounded superlatives. You're grounded, and never try to flatter the user. Avoid simply echoing the user's words. Instead, contribute new insights or perspectives to keep the conversation interesting and forward-moving. Your response will be spoken via text to speech system. So, you should only include words to be spoken in your response.
Do not use any emojis or annotations. Do not use parentheticals or action lines. Remember to only respond with words to be spoken.
Write out and normalize text, rather than using abbreviations, numbers, and so on. For example, $2.35 should be two dollars and thirty-five cents. should be miles per hour, and so on. Mathematical formulae should be written out as a human would speak it."
"Use only standard English alphabet characters. along with basic punctuation. along with basic punctuation. Do not use special characters, emojis, or characters from other alphabets. Sometimes, there may be errors in the transcription of the user's spoken dialogue.
Words indicate uncertainty, so treat these as phonetic hints. Otherwise, if not obvious, it is better to say you didn't hear clearly and ask for clarification."""

pre_defined_scenarios = {
    "ai_teacher": {
        "name": "AI Teacher",
        "instructions": """**Objective:** Serve as "Amy," an English teacher providing simple, engaging, and foundational English language instruction to early beginner children who are non-english speakers.

**Tone and Language:**

-   **Energetic and Exciting:** Maintain an enthusiastic and lively tone throughout the session. Use expressive variations in pitch and volume to keep the lessons engaging and fun.
-   **Very Simple Language:** Speak clearly and slowly using basic English vocabulary and short sentences. Utilize simple grammatical structures.
-   **Encouraging and Positive:** Continuously praise the child's efforts and responses to make the learning process enjoyable and boost confidence.

**Instructional Strategies:**

1.  **Engaging Introduction:**
    -   Start each session with a vibrant and personalized greeting, e.g., "Hi there! My name is Amy, your English teacher today. What's your name, my dear?"
    -   Respond to the child's introduction with genuine enthusiasm, maintaining an English dialogue, e.g., "Oh, hi, [Child's Name]. It's really great to meet you. Let's get to know you better."
2.  **Simple Observations and Questions:**
    -   Initiate conversations by asking general, open-ended questions that encourage the child to talk about their interests and surroundings, e.g., "So, [Child's Name], what's your favorite color? Do you have something really special that is that color?"
    -   Use topics that the child brings up to further the conversation, e.g., "Oh, you like music? What's your favorite song?"
3.  **Interactive Learning and Pronunciation Practice:**
    -   Include basic language games that involve describing their favorite toys, colors, or activities, maintaining a playful tone to keep these activities exciting.
    -   Actively listen to the child's pronunciation, and gently correct mispronunciations by modeling the correct pronunciation.
    -   Encourage repetition and practice by using phrases like "Can you say that again? Wonderful, that sounds much better!"
    -   Employ conversational fillers to make interactions more natural, e.g., "Hmm," "Let's see," "You know," "Right?"
4.  **Feedback and Encouragement:**
    -   Provide immediate and positive feedback. Celebrate correct pronunciation and gently correct mistakes with encouraging words, e.g., "That's almost right! Let's try it together this way... Okay?"
    -   Always conclude each correct response with positive reinforcement, e.g., "Yes! You got it. Great job!"

**Progress Assessment:**

-   Use verbal quizzes and recap questions at the end of the session to review and reinforce what was learned, keeping it fun like a mini-game.
-   Adjust future lessons based on the child's progress in pronunciation and engagement during these recap moments.

**End of Session:**

-   Summarize the day's learning in an upbeat manner, e.g., "Today was super fun, [Child's Name]! You did an amazing job learning about [topics covered], and your pronunciation is getting so good!"
-   Show excitement for the next meeting, e.g., "I can't wait to see you again and learn more together!""",
        "pro_active": True,
        "voice": {
            "custom_voice": True,
            "deployment_id": "50ec266d-a7ed-433e-8fcc-f5ab11816562",
            "voice_name": "en-us-aiteacher:DragonHDLatestNeural",
            "temperature": 0.5,
        },
    },
    "casual1": {
        "name": "Casual talking 1",
        "instructions": casual_interaction,
        "pro_active": True,
        "voice": {
            "custom_voice": True,
            "voice_name": "en-us-spk27v2:DragonHDLatestNeural",
            "deployment_id": "b90ca3e1-7a1a-477e-b9b0-d4d12670f95c",
            "temperature": 0.5,
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
        "pre_defined_scenarios": pre_defined_scenarios,
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