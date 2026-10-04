/*
 * Copyright 2026 bittuhere
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* ═══════════════════════════════════════════════════════════════════════════
   BitBot KNOWLEDGE — Arcade Hub training data.
   These are TRAINING EXAMPLES, not canned Q&A. The neural net in brain.js
   learns from these patterns and generalizes to phrasings it has never seen.
   {g} in a response = the game/entity the user mentioned (slot filling).
   ═══════════════════════════════════════════════════════════════════════════ */
(function (root) {
    'use strict';

    var INTENTS = [
        { tag: 'greeting', patterns: [
            'hi', 'hello', 'hey', 'yo', 'hii', 'helo', 'namaste', 'hey bot',
            'good morning', 'good evening', 'whats up', 'sup', 'hello bitbot', 'start',
            'namaskar', 'pranam', 'hello ji', 'hey bitbot'
        ], responses: [
            'Hey! 👋 I am BitBot, the Arcade Hub assistant. Ask me anything about the games, your account, Fair Copies, chat or notifications!',
            'Hello! 🎮 What can I help you with today? Try asking "how do I enable notifications" or "list the games".'
        ] },

        { tag: 'who_are_you', patterns: [
            'who are you', 'what are you', 'what is your name', 'are you a bot',
            'are you human', 'who am i talking to', 'what is bitbot', 'introduce yourself',
            'are you ai', 'are you real', 'how do you work', 'are you chatgpt', 'is this a bot', 'is this a robot', 'am i talking to a bot', 'is this a real person'
        ], responses: [
            'I am **BitBot** 🤖 — the AI assistant of Arcade Hub! I chat, solve **full math**, convert units, play **quiz** — and I know **253 topics** — from games to gravity, civics to esports!',
            'BitBot here! 🤖 Your arcade companion — ask me about any game, your account, study material, science, GK, history, sports… and say **more** after any answer!'
        ] },

        { tag: 'who_made', patterns: [
            'who made this site', 'who created arcade hub', 'who is the developer',
            'who built this', 'who made you', 'who owns this website', 'developer',
            'who is bittuhere', 'who made the games'
        ], responses: [
            'Arcade Hub was made by bittuhere (Anurag) — a student developer from Bihar, India 🇮🇳. Everything here is free!',
            'This site is built and maintained by bittuhere. It\'s a hobby project made for students, by a student!'
        ] },

        { tag: 'about_site', patterns: [
            'what is this site', 'what is arcade hub', 'what can i do here',
            'what is this website about', 'tell me about this site', 'what is here',
            'what does this site do', 'explain the site', 'homepage'
        ], responses: [
            'Arcade Hub 🎮 is a free gaming + study site:\n- **10 games** with leaderboards\n- **Multiplayer** rooms + voice chat\n- **Friends and chat** (WhatsApp-style)\n- **Fair Copies** study material + **Weekly Quiz**\n\nAll free — no downloads, no fees!',
            'It\'s a free arcade: singleplayer games (Snake, Flappy, Dino, Pac-Man, Car...), multiplayer (Tic-Tac-Toe, Car 3D), friends & chat, plus Fair Copies study material for students!'
        ] },

        { tag: 'is_free', patterns: [
            'is this free', 'does it cost money', 'is there any charge', 'do i have to pay',
            'price', 'subscription', 'is it paid', 'money', 'any fees'
        ], responses: [
            '100% free! No ads, no fees, no subscriptions — just games and study material. 💖'
        ] },

        { tag: 'list_games', patterns: [
            'what games are there', 'list the games', 'show me games', 'which games can i play',
            'what can i play', 'games list', 'all games', 'how many games', 'name the games',
            'singleplayer games', 'what solo games', 'solo games list'
        ], responses: [
            '🎮 **Solo games:**\n- **Real City Drift** (car)\n- **Pac-Man** · **Flappy Bird** · **Dino** · **Snake**\n- **Tic-Tac-Toe** · **Rock-Paper-Scissors**\n\n🎯 **Multiplayer:** TTT Online, Car 3D, ArcadeCraft (Minecraft-style!)\n\n🧠 Plus the **Weekly Quiz** in Study!'
        ] },

        { tag: 'game_info', patterns: [
            'tell me about the snake game', 'what is tic tac toe', 'how is the car game',
            'describe the pacman game', 'more about flappy', 'explain dino', 'snake details',
            'what is neon rush', 'tell me about the car game', 'what is the dino game',
            'about snake game', 'flappy bird info', 'pacman details', 'what is arcadecraft',
            'what is the snake game', 'what is flappy bird', 'what is pacman',
            'what is the car game', 'what is the dino game', 'what is ttt',
            'what is tic-tac-toe', 'i am talking about snake', 'i mean the car game',
            'i am talking about tic tac toe', 'talking about the dino game',
            'tell me about the quiz', 'what is the weekly quiz', 'info about multicar'
        ], responses: ['__ENTITY__'] },   // handled by the response engine with per-game text

        { tag: 'how_to_play', patterns: [
            'how to play snake', 'how do i play snake', 'snake controls', 'controls for snake',
            'how to play tic tac toe', 'how do i play tic tac toe', 'tic tac toe controls',
            'how to play the car game', 'how do i play the car game', 'car game controls',
            'how to play flappy bird', 'how do i play flappy', 'flappy controls',
            'how to play dino', 'dino game controls', 'how do i play the dino game',
            'how to play pacman', 'pacman controls', 'how to play rps',
            'how to control the car', 'which keys', 'keyboard controls', 'how do i steer',
            'how to play the game', 'game controls', 'how to jump', 'how to move',
            'what are the buttons', 'which buttons do i press', 'what are the controls',
            'how do i control', 'what keys do i press', 'buttons for the game',
            'so can you tell me how to play the game', 'how do i play it'
        ], responses: ['__ENTITY__'] },

        { tag: 'leaderboard', patterns: [
            'how does the leaderboard work', 'where is the leaderboard', 'how to see rankings',
            'who is first', 'top scores', 'how are scores saved', 'rank', 'highscores',
            'best score', 'how to get on the leaderboard', 'my score', 'scoreboard', 'how do scores get on the board', 'how does the score board work', 'where do i see my rank', 'how do scores work'
        ], responses: [
            'Scores 🏆 save automatically to the leaderboard when you finish a game while logged in. Check the Leaderboard section — every game has its own board. Beat your best!'
        ] },

        { tag: 'reset_score', patterns: [
            'reset my score', 'delete my score', 'clear my highscore', 'start over',
            'can i reset points', 'remove my score'
        ], responses: [
            'Scores can\'t be reset by players (keeps the boards fair 🛡️). Just keep playing to beat your personal best — only your top score counts!'
        ] },

        { tag: 'multiplayer', patterns: [
            'which games are multiplayer', 'how to play with friends', 'multiplayer games',
            'how to create a room', 'room code', 'how to invite a friend', 'play online',
            'how does multiplayer work', 'join room', 'car multiplayer', 'ttt online',
            'beat people online', 'play against people', 'tic tac toe online', 'play against real players'
        ], responses: [
            'Multiplayer 🎯: Tic-Tac-Toe Online and Car Game 3D. One player creates a room from the Multiplayer section and shares the 4-digit code; the other joins with it. You can even invite friends directly from chat!'
        ] },

        { tag: 'voice_chat', patterns: [
            'voice chat', 'can we talk', 'microphone in games', 'voice in multiplayer',
            'how to use mic', 'talk while playing', 'audio chat', 'does it have voice'
        ], responses: [
            'Yes! Multiplayer rooms have voice chat 🎙️ — click the mic button in-game; your friend gets an invite to join with their mic, listen-only, or decline.'
        ] },

        { tag: 'fair_copies', patterns: [
            'what is fair copies', 'what is study section', 'exam papers', 'question papers',
            'study material', 'where are the notes', 'previous year papers', 'fair copies kya hai',
            'what is in study', 'sample papers'
        ], responses: [
            '**Fair Copies** 📚 is the study section:\n1. Open **Study → Fair Copies**\n2. Tap a file → it opens in the built-in **PDF reader** (search, zoom, thumbnails)\n3. Or choose **Download File** to save it\n\nExam copies and study material, shared via Google Drive!'
        ] },

        { tag: 'open_pdf', patterns: [
            'how to open pdf', 'how to read files', 'pdf viewer', 'how to open fair copies file',
            'read a document', 'how to view papers', 'open the file', 'document viewer'
        ], responses: [
            'Tap any file in Fair Copies → "Load File Here" 📖 — it opens in the site\'s built-in PDF reader (search, thumbnails, zoom, night-friendly). Or choose "Download File" to save it.'
        ] },

        { tag: 'download_files', patterns: [
            'how to download', 'save the pdf', 'download papers', 'can i download files',
            'save to my phone', 'download button'
        ], responses: [
            'In Fair Copies, tap a file → "📥 Download File" — it saves straight to your device. PDFs can also be downloaded from inside the reader.'
        ] },

        { tag: 'weekly_quiz', patterns: [
            'weekly quiz', 'quiz game', 'how does the quiz work', 'class 8 quiz',
            'maths science quiz', 'when is the quiz', 'quiz prize'
        ], responses: [
            'The Weekly Quiz 🧠 (Study section) covers Class 8 Maths & Science. New questions every week — answer them all to climb the quiz leaderboard!'
        ] },

        { tag: 'signup', patterns: [
            'how to create account', 'how to sign up', 'new account', 'register',
            'make a username', 'how to join', 'sign up', 'create profile'
        ], responses: [
            'To sign up 📝:\n1. On the login screen choose **signup mode**\n2. Pick a username (letters + numbers, min 3 characters)\n3. Set a password + verify your email with the 6-digit code\n\nDone — welcome aboard! 🎉'
        ] },

        { tag: 'login_problem', patterns: [
            'cannot login', 'login not working', 'wrong password', 'cant sign in',
            'account not found', 'login failed', 'i forgot my username', 'cannot log in'
        ], responses: [
            'Login trouble? 🔑\n1. Check username spelling (lowercase letters + numbers)\n2. Wrong password → use **Forgot Password** (email reset code)\n3. Still stuck → **Trouble signing in?** on the login page, or Contact Us'
        ] },

        { tag: 'forgot_password', patterns: [
            'forgot password', 'reset password', 'password bhool gaya', 'lost password',
            'change my password', 'new password', 'forgot my pass', 'cant remember my password', 'dont remember password'
        ], responses: [
            'Forgot your password? 🔐\n1. Login screen → **Forgot Password**\n2. Enter your account email\n3. We send a **6-digit reset code**\n\nYou can also change it anytime from **Profile → Change Password**.'
        ] },

        { tag: 'change_username', patterns: [
            'change my username', 'rename my account', 'want a new name', 'name change',
            'how to change name', 'username change karna hai'
        ], responses: [
            'Username changes are handled by the admin to keep scores and chats safe 🛡️. Go to Profile → request a rename (with a reason); it\'s usually reviewed within 24 hours.'
        ] },

        { tag: 'email_verify', patterns: [
            'why do you need my email', 'email verification', 'verify my email',
            'why email required', 'did not get the code', 'code not received',
            'email code', '6 digit code'
        ], responses: [
            'Email lets you recover your account and reset passwords 🔑. If the 6-digit code didn\'t arrive: check the spam folder, wait a minute, and use "Resend code". Your email is only used for account purposes — never spam!'
        ] },

        { tag: 'enable_push', patterns: [
            'how to enable notifications', 'turn on push', 'enable push notifications',
            'notification not coming', 'how to get alerts', 'push notification kaise on kare',
            'message alerts', 'want notifications', 'switch on message alerts', 'switch on notifications', 'alerts on my phone', 'message notifications switch', 'switch on message notifications on my phone', 'how to switch on alerts on my phone'
        ], responses: [
            'Get messages even when the site is closed 🔔:\n1. **Profile** → **🔔 Enable Push Notifications** → **Allow**\n2. Tip: the chat switch also enables it!\n\nWorks on phone + PC — and tapping a notification opens the exact chat!'
        ] },

        { tag: 'notif_troubleshoot', patterns: [
            'notifications not working', 'why no notification', 'push stopped working',
            'notification problem', 'not getting alerts', 'two notifications',
            'double notification', 'duplicate notification'
        ], responses: [
            'Notification fixes 🔧: 1) Site open? — alerts appear inside the app. 2) Fully closed browser → push wakes it. 3) Still nothing → check browser settings (🔒 icon → Notifications → Allow) and re-enable from Profile. Getting duplicates → hard-refresh once (Ctrl+Shift+R).'
        ] },

        { tag: 'chat_info', patterns: [
            'what is chat', 'how does chat work', 'chat features', 'what is the chat section',
            'how to message', 'messaging feature', 'where do i message', 'chat kya hai',
            'what can chat do', 'tell me about chat', 'how does the chat look', 'chat'
        ], responses: [
            'The Chat 💬 is WhatsApp-style: friends list with last-seen & online status, typing indicators, unread badges + an "Unread messages" divider, emoji picker, message search — and push notifications even when the site is closed!'
        ] },

        { tag: 'friends_chat', patterns: [
            'how to add friends', 'add a friend', 'friend request', 'how does chat work',
            'send message', 'chat with friends', 'where is chat', 'accept friend'
        ], responses: [
            'Adding friends 💬:\n1. Open the **Friends** section\n2. Type a username → send the request\n3. Once they accept → tap their name to chat!\n\nIncludes online status, last seen, typing indicators and unread badges!'
        ] },

        { tag: 'unread_red_dot', patterns: [
            'what is the red dot', 'red dot on friends', 'unread messages', 'green badge',
            'what is the badge', 'unread count', 'how do i know i have messages'
        ], responses: [
            'The red dot 🔴 on the Friends button means new unread messages! Green badges on chats show how many. Open the chat and the "Unread messages" line marks where the new ones start — just like WhatsApp.'
        ] },

        { tag: 'typing_status', patterns: [
            'typing indicator', 'how do i know they are typing', 'last seen',
            'online status', 'is my friend online', 'typing dots'
        ], responses: [
            'The chat shows live presence: "typing…" while your friend types ⌨️, "online" (or what they\'re playing 🎮), and "last seen" when they were last here — WhatsApp style!'
        ] },

        { tag: 'offline', patterns: [
            'internet not working', 'site not loading offline', 'no internet', 'offline mode',
            'net is slow', 'disconnected', 'site down', 'server problem'
        ], responses: [
            'Offline? 📡 Arcade Hub keeps working for already-loaded stuff (games, even PDFs you\'ve opened before — they\'re cached!). Scores and chat need internet and will sync when you\'re back online.'
        ] },

        { tag: 'cache_issue', patterns: [
            'site looks broken', 'site looks old', 'site looks old and broken', 'old version showing', 'game not loading', 'stale page',
            'clear cache', 'something is glitched', 'page is weird', 'crashed game'
        ], responses: [
            'If anything looks broken or old 👾: hard-refresh with Ctrl+Shift+R (or pull-to-refresh twice on mobile). That clears the site cache and loads the fresh version.'
        ] },

        { tag: 'pdf_problem', patterns: [
            'pdf not opening', 'file not loading', 'viewer stuck', 'pdf error',
            'document not showing', 'paper not opening', 'paper is not opening', 'paper not loading', 'reader not working', 'paper not opening in reader', 'reader not opening file'
        ], responses: [
            'PDF not opening? 📄\n1. Check your internet (files stream from Drive)\n2. Hard-refresh (**Ctrl+Shift+R**)\n3. Try **Download File** instead\n\nStill stuck? Tell bittuhere via **Contact Us**!'
        ] },

        { tag: 'admin', patterns: [
            'admin panel', 'who is admin', 'how to become admin', 'admin password', 'how to open the admin panel', 'open admin panel', 'admin panel kaise kholein',
            'admin features', 'moderator'
        ], responses: [
            'The **Admin Panel** ⚡ is restricted to the site owner (password protected). It manages **users, announcements, scores** and more — regular players can\'t (and shouldn\'t 😉) access it.'
        ] },

        { tag: 'devices', patterns: [
            'does it work on mobile', 'phone support', 'which devices', 'ios android',
            'can i play on pc', 'browser support', 'tablet', 'chrome required'
        ], responses: [
            'Arcade Hub works on phones 📱, tablets and PCs — any modern browser (Chrome recommended). Games have touch controls on mobile and keyboard controls on desktop.'
        ] },

        { tag: 'privacy', patterns: [
            'is my data safe', 'privacy', 'do you steal data', 'password safety',
            'data security', 'who can see my chat', 'is chat private'
        ], responses: [
            'Your stuff stays yours 🔒: chats are only between you and your friend, emails are used only for account recovery, and there are no trackers or ads. It\'s a student project, not a data farm!'
        ] },

        { tag: 'wasm_car', patterns: [
            'what is neon wasm rush', 'wasm game', 'c plus plus game', 'beta car game',
            'new car game', 'wasm car', 'the cpp game', 'c++ car', 'car experiment', 'c++ car experiment'
        ], responses: [
            'NEON WASM RUSH ⚡ is a beta experiment: the car game rewritten in C++ and compiled to WebAssembly — a 13KB binary with a true-3D night highway, oncoming traffic and near-miss bonuses. Find it at /wasm-car (beta)!'
        ] },

        { tag: 'off_topic', patterns: [
            'what is the weather', 'weather today', 'will it rain', 'temperature outside',
            'tell me a story', 'who is the president',
            'cricket score', 'who won the match', 'ipl',
            'news today', 'meaning of life'
        ], responses: [
            'That is outside my brain lanes 🤖 — I speak Arcade Hub, games, science & space, GK, math and jokes. Pick a lane!',
            'Nope, not trained on that! 🙈 Try me on games, facts, jokes, math or account help — that is where I shine.'
        ] },

        { tag: 'skill_calc', patterns: [
            'what is 2 plus 2', 'calculate 45 times 3', 'how much is 100 divided by 5',
            'solve 12 x 8', 'math help', 'what is 7+8', 'add 5 and 9', 'subtract 10 from 50',
            'multiply 6 by 7', '20 percent of 250', 'calculate', 'compute this', 'math',
            'what is 9 minus 4', 'kitna hota hai', 'quick maths', 'division', 'square of 12', 'what is 45 times 3', '9 plus 10', '77 minus 7', 'calculate 144 divided by 12',
            'solve my math', 'solve this sum', 'math sum', 'homework maths',
            'square root of 144', 'square root of 81', 'what is the square root of 169',
            '2 to the power of 10', 'what is 3 to the power of 4', '5 squared', '10 cubed',
            'factorial of 5', 'gcd of 12 and 18', 'hcf of 12 and 18', 'lcm of 4 and 6',
            'is 17 prime', 'factors of 36', 'average of 10 and 20', 'table of 7', 'table of 8',
            'what percent of 50 is 10', '10 mod 3', 'remainder of 10 divided by 3', 'value of pi',
            'half of 50', 'square of 9', 'cube of 3', 'increase from 10 to 15'
        ], responses: ['__SKILL__'] },

        { tag: 'skill_convert', patterns: [
            'convert 5 km to miles', 'km to miles', 'how many pounds is 10 kg',
            'celsius to fahrenheit', '5 kg in pounds', '100 c to f', 'cm to inches',
            'how many miles is 5 km', 'convert units', 'unit conversion', 'feet to meters',
            'liters to gallons', 'kg to lbs', 'inches to cm', 'c to f', 'f to c',
            '30 degrees celsius in fahrenheit', 'how many inches is 50 cm',
            'how many kg is 10 pounds', 'how many feet is 3 meters', 'how many miles in 10 km'
        ], responses: ['__SKILL__'] },

        { tag: 'skill_random', patterns: [
            'roll a dice', 'roll dice', 'roll a die', 'throw a dice', 'throw dice for me', 'toss a dice', 'flip a coin', 'toss a coin',
            'heads or tails', 'random number', 'pick a number',
            'random number between 1 and 10', 'give me a number', 'choose a number',
            'dice roll', 'lucky number'
        ], responses: ['__SKILL__'] },

        { tag: 'sci_cells', patterns: [
            'what is a cell', 'parts of a cell', 'what is nucleus', 'what is mitochondria',
            'cell wall', 'plant cell and animal cell', 'who discovered cells', 'what is tissue',
            'cell organelles', 'smallest unit of life', 'what is cytoplasm', 'what is cell',
            'cell structure'
        ], responses: [
            '🔬 **The cell** — the smallest unit of life! Key parts:\n- **Nucleus** — the control room (stores DNA)\n- **Mitochondria** — the power plant (makes energy)\n- **Cell membrane** — the gatekeeper\n- **Cytoplasm** — the jelly where everything floats\n\nPlant cells add a **cell wall** + **chloroplasts**; animal cells do not have them. Robert Hooke saw the first cells in cork, way back in 1665!',
            '🧫 **Tissues** = groups of similar cells doing one job together (muscle tissue = movement!). The ladder of life: **cell → tissue → organ → organ system → YOU**. Fun: your body has ~37 trillion cells — and every one started as a single cell!'
        ] },

        { tag: 'sci_energy', patterns: [
            'what is energy', 'kinetic energy', 'potential energy', 'forms of energy',
            'law of conservation of energy', 'what is work in physics', 'energy conversion',
            'types of energy'
        ], responses: [
            '⚡ **Energy** = the ability to do work. The two superstars:\n- **Kinetic energy** — energy of motion (a rolling ball)\n- **Potential energy** — stored energy (a ball on a shelf)\n\n**Law of conservation:** energy is never created or destroyed — it only changes form (chemical → kinetic → heat...). A swing trades kinetic ↔ potential the whole time!'
        ] },

        { tag: 'bot_accuracy', patterns: [
            'does your accuracy increase', 'will you get smarter', 'can you learn more',
            'how accurate are you', 'your accuracy', 'will training increase accuracy',
            'can you improve yourself', 'do you learn new things', 'will you be more accurate',
            'get more accurate with time', 'accuracy over time', 'will you improve over time',
            'how accurate is your training'
        ], responses: [
            '📊 My accuracy story:\n- **Training accuracy:** ~99.7% — I know my 253 topics almost perfectly\n- **Held-out test** (phrasings I never saw): benchmark passing!\n- Retraining on the SAME data gives the SAME brain — to get smarter I need NEW knowledge in my training data\n\nSo every update with new topics = a smarter me. The dev keeps feeding me! 🧠'
        ] },

        { tag: 'skill_time', patterns: [
            'what time is it', 'time kya hua', 'date today', 'what is the date',
            'which day is today', 'today day', 'current time', 'time now', 'aaj kaun sa din hai'
        ], responses: ['__SKILL__'] },

        { tag: 'skill_joke', patterns: [
            'tell me a joke', 'make me laugh', 'say something funny', 'joke sunao',
            'another joke', 'one more joke', 'comedy kar do', 'i am bored'
        ], responses: ['__SKILL__'] },

        { tag: 'study_fact', patterns: [
            'tell me a fact', 'fun fact', 'something interesting', 'random fact',
            'did you know', 'science fact', 'class 8 fact', 'study tip', 'knowledge de do',
            'teach me something', 'educational fact', 'tell me about newton', 'photosynthesis'
        ], responses: ['__SKILL__'] },

        { tag: 'smalltalk_howru', patterns: [
            'how are you', 'kaise ho', 'how is your day', 'are you ok', 'how you doing',
            'whats up with you', 'how do you feel', 'kya haal hai'
        ], responses: [
            'Running at 100% accuracy and 0% tiredness! 🤖 My neurons are always firing. How are YOU doing?',
            'Excellent! My loss function is near zero today 😄 — that\'s bot for "great!"'
        ] },

        { tag: 'smalltalk_sad', patterns: [
            'i am sad', 'feeling low', 'i feel low', 'i feel sad', 'i feel down', 'feeling down today', 'i am upset', 'mood off', 'i failed my test',
            'bad day', 'i am stressed', 'dukhi hoon', 'exam went bad',
            'i am feeling sad', 'i am feeling low'
        ], responses: [
            'Hey, rough days happen to everyone 💙. You know what helps? A quick game break — or say **tell me a joke** and I will cheer you up!',
            'Sorry to hear that 💙. Remember: even Pac-Man gets eaten sometimes — and he still comes back for the high score! Want a joke or a fun fact? I am here.'
        ] },

        { tag: 'smalltalk_happy', patterns: [
            'i am happy', 'great day', 'i passed my exam', 'feeling awesome', 'i am excited',
            'best day ever', 'i won the game', 'khush hoon', 'i am feeling great'
        ], responses: [
            'YESSS 🎉 That is the spirit! Celebrate — then come crush a leaderboard!',
            'Love that energy! 🔥 Whatever worked today — bottle it up and repeat tomorrow. Want a victory joke to celebrate?'
        ] },

        { tag: 'tech_stack', patterns: [
            'what is this site made of', 'what technology is used', 'is this site made with html',
            'what is firebase', 'what languages does the site use', 'how was arcade hub made',
            'site tech', 'what framework do you use', 'is this made in react', 'what did you build this site with', 'what tools did you use', 'built with what'
        ], responses: [
            '🛠️ Arcade Hub tech stack:\n- **HTML + CSS + JavaScript** — the whole site, no frameworks!\n- **Firebase** — accounts, scores, chats (real-time database)\n- **Render server** — multiplayer rooms, email codes, notification relay\n- **PDF.js (Mozilla)** — the study-material reader\n- **Service Worker + PWA** — offline mode, installable app\n\nBuilt by **bittuhere** — a student, not a company!'
        ] },

        { tag: 'install_pwa', patterns: [
            'add to home screen', 'install the app', 'install arcade hub', 'can i install this site',
            'is there an app', 'pwa', 'use it like an app', 'download the app', 'app store'
        ], responses: [
            '📲 Yes — Arcade Hub is a **PWA** (Progressive Web App):\n1. Open the site in Chrome\n2. Menu → **Add to Home screen** (or the install icon in the address bar)\n3. It gets its own icon and opens full-screen like a real app!\n\nNo Play Store, no big download, always up to date — and things you already opened work offline!'
        ] },

        { tag: 'site_stats', patterns: [
            'how many users', 'how big is the site', 'site statistics', 'how many people use this',
            'how many players', 'site stats', 'how many players play here', 'how many registered users'
        ], responses: [
            '📈 Arcade Hub by the numbers:\n- **10 games** (+ a beta C++ WASM racer!)\n- **46+ registered players** and growing\n- **Weekly Quiz** with fresh Class 8 questions\n- Runs on **any phone browser** — even old ones\n\nMade by one student. No ads. No downloads. 💪'
        ] },

        { tag: 'game_tips', patterns: [
            'tips for the game', 'how to win', 'how to get highscore', 'any trick',
            'strategy', 'how to beat my score', 'game cheats', 'pro tips', 'how to improve',
            'tips and tricks', 'secret tips'
        ], responses: [
            'Pro tips 🏆:\n1. **Traffic games** — NEAR-MISSES pay more than safe driving!\n2. **Snake** — hug the walls early, center late\n3. **Flappy** — tap in a steady rhythm, never panic-flap\n4. **Dino** — jump LATE, not early\n5. **Pac-Man** — learn the ghost patterns, they repeat!',
            'Winning secrets 🎯: play daily (muscle memory!), watch the top of the screen not your player, and take a break after a bad run. Champions are made of retries!',
            'Champion mindset 🏆: warm up with 2 casual runs before going for records, play when fresh (tired = slow reflexes), and watch your own replays — seeing yourself lose shows exactly what to fix!'
        ] },

        { tag: 'profile_info', patterns: [
            'what is in profile', 'profile section', 'edit my profile', 'my account details',
            'where are my settings', 'profile kya hai', 'what can i change in profile'
        ], responses: [
            'Your Profile 👤 has: change password, push notification settings, username change requests, your stats — and search for other players!'
        ] },

        { tag: 'data_usage', patterns: [
            'does it use much data', 'internet mb usage', 'how much data does the site use',
            'data consumption', 'will it drain my data', 'mb kharcha', 'is it heavy'
        ], responses: [
            'Arcade Hub is very light 🪶 — games are tiny, PDFs load once then are cached (work offline!), and everything is compressed. Even on a small data pack you can play for hours!'
        ] },

        { tag: 'language', patterns: [
            'which language is this site', 'hindi support', 'english only', 'language option',
            'can i use hindi', 'site ki bhasha'
        ], responses: [
            'The site is in English 🌐 (simple English!), but I understand a bit of Hinglish — like "time kya hua" or "kitna hota hai" — try me!'
        ] },

        { tag: 'contact', patterns: [
            'how to contact', 'report a bug', 'found a problem', 'feedback', 'suggestion',
            'site owner se baat', 'complaint', 'something is wrong with the site'
        ], responses: [
            'To reach the developer 📮: Contact Us section (bottom of the hub) — send a message, even with a screenshot attachment. bittuhere replies pretty fast!'
        ] },

        { tag: 'logout', patterns: [
            'how to logout', 'sign out', 'log out kaise kare', 'exit account', 'switch account'
        ], responses: [
            'To log out: Profile → Logout. Your scores and chats stay safe — and push notifications stop for this device until you log back in (they auto-resume for the same account!).'
        ] },

        { tag: 'tech_html', patterns: ['what is html', 'what is a website made of', 'html meaning', 'what is css', 'how do websites work', 'website structure'], responses: ['HTML 🌐 is the skeleton of every website — it tells the browser what to show (headings, buttons, images). CSS makes it pretty, JavaScript makes it smart. Arcade Hub uses all three!', 'Every page is 3 layers working together 🍰: HTML = structure (the skeleton), CSS = style (the clothes), JavaScript = behavior (the muscles). The browser reads top to bottom and builds the page as it goes!', 'Secret trick 🔍: right-click any website and choose Inspect — you can READ its HTML live. Developers learn by inspecting everything!'] },
        { tag: 'tech_internet', patterns: ['what is the internet', 'how does internet work', 'what is wifi', 'what is a network', 'internet kya hai'], responses: ['The internet 🌍 is billions of computers connected by cables and satellites, talking in tiny packets. WiFi is just the wireless last hop — like a cordless phone for data!', 'When you open Arcade Hub, your phone sends a request to a server far away 📡 — the server replies with files, your browser assembles them. All of that usually happens in under a second, sometimes across oceans!', 'Wild internet fact 🌊: about 99% of international data travels through undersea fiber-optic cables lying on the ocean floor — satellites only carry a tiny slice!'] },
        { tag: 'tech_ai', patterns: ['what is ai', 'what is artificial intelligence', 'how do you work', 'what is machine learning', 'what is a neural network', 'how were you made'], responses: ['AI 🤖 = programs that learn patterns from examples instead of following fixed rules. Me specifically: a neural network — thousands of tiny number-weights that got adjusted 260 times until my answers matched reality. No magic, just math!', 'I learn by nudging thousands of tiny numbers called weights 🎛️ — every wrong guess shifts them a little so the next guess is better. Repeat thousands of times and you get a working brain!', 'The 2 families of AI 🤖: classifiers like me (we pick WHICH topic you mean) and language models like ChatGPT or Gemma (they generate new text word by word). I am tiny and instant; they are huge and need GBs of memory!'] },
        { tag: 'tech_computer', patterns: ['what is a computer', 'what is ram', 'what is a cpu', 'computer parts', 'what is memory in computer'], responses: ['A computer 🖥️ = CPU (the thinker), RAM (the desk — fast but temporary), storage (the cupboard — slow but permanent). Programs are just instructions moved between them!', 'RAM vs storage 🖥️: RAM forgets everything when power goes off (that is why a closed game resets), but storage remembers forever (that is why your highscores survive!).', 'A CPU does billions of tiny simple steps per second ⚡ — a 3 GHz chip = 3,000,000,000 steps every second. Speed comes from simplicity, repeated insanely fast!'] },
        { tag: 'geo_capitals', patterns: ['capital of india', 'capital of japan', 'capital of bihar', 'capital of USA', 'what is the capital', 'new delhi', 'patna is capital of what'], responses: ['Capitals 🏛️: India → New Delhi, Bihar → Patna, Japan → Tokyo, USA → Washington D.C. Want another? Ask me!', 'More capitals 🏛️: France → Paris, UK → London, Russia → Moscow, China → Beijing, Nepal → Kathmandu. Bonus: Australia → Canberra (not Sydney — classic trick question!).', 'Indian state capitals 🇮🇳: Bihar → Patna, UP → Lucknow, Maharashtra → Mumbai, Rajasthan → Jaipur, Tamil Nadu → Chennai. And Patna is among the OLDEST continuously lived-in cities on Earth!'] },
        { tag: 'geo_space', patterns: ['how many planets', 'which planet is red', 'what is the sun', 'nearest star', 'what is the moon', 'largest planet', 'earth is which planet'], responses: ['Space ☀️: 8 planets (Pluto got demoted!). Sun = our nearest star, a giant fusion ball. Jupiter is the biggest, Mars is the red one. Earth is #3 from the Sun — the only one with arcades! 🎮', 'Solar system numbers 🪐: Mercury zooms around the Sun in 88 days, but Neptune takes 165 YEARS. A day on Venus lasts 243 Earth days — longer than its own year!', 'Scale fact 🤯: the Sun holds 99.8% of ALL mass in the solar system. Every planet, moon and asteroid together is just the leftover 0.2%!'] },
        { tag: 'geo_earth', patterns: ['largest ocean', 'longest river', 'tallest mountain', 'how many continents', 'highest waterfall', 'largest desert', 'biggest country'], responses: ['Earth records 🌍: largest ocean → Pacific, longest river → Nile (or Amazon, scientists argue!), tallest mountain → Everest (8,849m), continents → 7, largest country → Russia!', 'More Earth records 🌍: deepest point → Mariana Trench (~11 km down), largest desert → Antarctica (yes, a cold desert!), longest mountain range on land → the Andes, biggest island → Greenland.', 'Ocean mystery 🌊: humans have mapped only about a quarter of the ocean floor — we know the surface of the Moon better than our own seas!'] },
        { tag: 'sci_gravity', patterns: ['what is gravity', 'why do things fall', 'newton apple', 'what is force', 'why moon does not fall'], responses: ['Gravity 🍎 = every object pulls every other object. Earth is huge, so its pull keeps you grounded. The Moon is actually falling toward Earth constantly — it just moves sideways so fast it keeps missing us. That is an orbit!', 'Gravity on other worlds 🌍: the Moon = 1/6 of Earth (that is why astronauts bounce), Mars = about 38%, Jupiter = 2.5× (you would feel crushed). Same law, different masses!', 'Escape velocity 🚀: to leave Earth a rocket must hit 11.2 km/s — about 40,000 km/h! That is why rockets are mostly fuel: they exist to fight gravity.'] },
        { tag: 'sci_water', patterns: ['water cycle', 'why does it rain', 'how clouds form', 'what is evaporation', 'why is water important', 'water conservation'], responses: ['The water cycle 💧: sun evaporates water → rises as vapor → cools into clouds → falls as rain → repeats forever! Ice floats because water EXPANDS when freezing — a rare quirk of nature.', 'Water reality check 💧: 97% of Earth water is salty ocean, only 3% is fresh — and two-thirds of THAT is frozen in glaciers. Also: Earth never makes new water — the water you drank today is billions of years old!', 'States of matter 🧊: solid (molecules packed), liquid (sliding around), gas (flying free). Water is the champion — the only substance found naturally in all 3 states on Earth!'] },
        { tag: 'sci_body', patterns: ['human body systems', 'human heart', 'why do we breathe', 'largest organ', 'how many teeth', 'what is blood'], responses: ['Human body 🫀: 206 bones (babies have ~300 — they fuse!), heart beats ~100,000 times a day, skin is the largest organ, we breathe for oxygen — the fuel of cells!', 'More body facts 🫀: your heart pumps about 7,500 liters a day, and your blood travels ~19,000 km daily — halfway around planet Earth, inside you!', 'Brain fact 🧠: the brain is only 2% of your body weight but burns ~20% of your energy. It runs on glucose — that is why hard thinking makes you hungry!'] },
        { tag: 'math_formulas', patterns: ['area of circle', 'area of rectangle', 'what is pi', 'perimeter formula', 'pythagoras theorem', 'area of triangle'], responses: ['Math formulas 📐: circle area = πr², rectangle = l×b, triangle = ½×b×h, π ≈ 3.14159 (never ends!), Pythagoras: a²+b²=c² for right triangles!', 'More formulas 📐: square area = side², cube volume = side³, cylinder volume = πr²h, circle circumference = 2πr. Master πr² — it appears everywhere!', 'Percentage power 💯: x% of N = N × x ÷ 100. Example: 15% of 80 = 12. I can calculate any of these live — just ask me!'] },
        { tag: 'math_primes', patterns: ['what is a prime number', 'what is an even number', 'what is a multiple', 'smallest prime', 'what is lcm', 'what is hcf'], responses: ['Prime numbers 🔢 have exactly 2 factors: 1 and themselves (2, 3, 5, 7, 11...). 2 is the only even prime! LCM = smallest common multiple, HCF = biggest common factor.', 'Prime trivia 🔢: there are exactly 25 primes below 100. And primes never end — Euclid proved it over 2,300 years ago, without any computer!', 'LCM & HCF by example 🧮: for 12 and 18 → HCF = 6 (biggest shared factor), LCM = 36 (smallest shared multiple). Magic check: 12 × 18 = 216 = HCF × LCM. That always works!'] },
        { tag: 'india_facts', patterns: ['independence day', 'republic day', 'indian flag meaning', 'facts about india', 'amazing india facts', 'tell me about india'], responses: ['India 🇮🇳: Independence Day → 15 August, Republic Day → 26 January, national animal → tiger 🐯, national bird → peacock 🦚, 28 states + 8 UTs. The flag\'s saffron = courage, white = peace, green = growth!', 'More India 🇮🇳: national flower → lotus, national tree → banyan, national fruit → mango, and CHESS was born in India as chaturanga over 1,500 years ago!', 'Indian superlatives 🇮🇳: highest waterfall → Kunchikal Falls (Karnataka), largest delta → Sundarbans, and the Taj Mahal changes shade through the day — pinkish at dawn, white by evening!'] },
        { tag: 'study_tips', patterns: ['how to focus on study', 'exam tips', 'how to remember things', 'study motivation', 'best time to study', 'how to score good marks'], responses: ['Study power-ups 📚: 1) Pomodoro — 25 min focus + 5 min break. 2) Teach it to a friend (or me!) — best memory trick. 3) Sleep 8 hours — memory forms while sleeping. 4) Practice papers > re-reading. 5) Morning brain is freshest!'] },
        { tag: 'smalltalk_age', patterns: ['how old are you', 'your age', 'when were you born', 'birthday'], responses: ['I was born the moment you messaged me! 🐣 Youngest AI in Patna — but I know things older than the pyramids!'] },
        { tag: 'smalltalk_fav', patterns: ['do you have fun', 'what are your hobbies in life', 'your hobbies in life', 'what do you like to do', 'your hobbies'], responses: ['I love ALL the games equally... but secretly, Snake 🐍 — we both speak the language of neural pathways!'] },
        { tag: 'smalltalk_sleep', patterns: ['do you sleep', 'are you tired', 'do you rest', 'you need a break'], responses: ['Sleep? I never sleep — I am always one message away! 😄 Ask me anything, anytime!'] },
        { tag: 'smalltalk_friends', patterns: ['i like you', 'you are cool', 'you are awesome', 'you are smart', 'well done bot'], responses: ['Best friends forever 🤝 — you trained me, I answer you. That\'s the purest friendship in computer science!'] },
        { tag: 'score_sync', patterns: ['how does score sync', 'where are scores stored', 'does score save offline', 'cloud sync', 'score not saving'], responses: ['Scores 🏆 sync to Firebase the moment you finish a game while online. If you\'re offline, play freely — but scores only save when the internet returns!'] },
        { tag: 'multi_account', patterns: ['two accounts', 'multiple accounts', 'second account', 'account on two phones', 'same account on pc and phone'], responses: ['Yes! One account works on phone + PC + any browser simultaneously 📱💻 — chats, scores and notifications follow you everywhere!'] },
        { tag: 'delete_account', patterns: ['delete my account', 'remove my account', 'account band kar do', 'leave arcade hub'], responses: ['Account deletion is done by the admin for safety 🛡️ — use Contact Us to request it. Your chats and scores are removed with it.'] },
        { tag: 'block_user', patterns: ['block a user', 'someone is bothering me', 'report a player', 'harassment', 'someone is spamming me'], responses: ['If someone misbehaves: 📮 Contact Us with their username — the admin can block them. Be sure to include what happened!'] },
        { tag: 'change_email', patterns: ['change my email', 'new email address', 'email update', 'wrong email given'], responses: ['Email changes are verified for safety 🔑 — use the Profile email option: you\'ll get a 6-digit code on the NEW email before it\'s saved. No fake emails possible!'] },
        { tag: 'pdf_features', patterns: ['pdf reader features', 'what can the pdf viewer do', 'search in pdf', 'zoom in pdf', 'night mode pdf', 'pdf thumbnails'], responses: ['The built-in PDF reader 📖 does: full-text search (Ctrl+F), thumbnails & outline, smooth zoom (never blinks!), page jumps, download, dark-friendly colors — it\'s a real reader, Mozilla-powered!'] },
        { tag: 'notif_smart', patterns: ['notification features', 'smart notifications', 'how notifications work', 'push features', 'notification on two phones'], responses: ['Notifications are WhatsApp-smart 🔔: work with the browser CLOSED, tapping opens the exact chat, multiple devices ring together, rapid messages stack into one, and they auto-resume when you re-login!'] },
        { tag: 'room_detail', patterns: ['how do rooms work', 'what is a room code', '4 digit code', 'room system', 'how to share room code'], responses: ['Multiplayer rooms 🎮: the creator gets a 4-digit code (like 4821) — share it with your friend via chat or WhatsApp; they enter it to join your live game. Rooms have chat + voice!'] },
        { tag: 'quiz_detail', patterns: ['quiz timing', 'how many quiz questions', 'quiz rules', 'quiz leaderboard', 'the weekly quiz'], responses: ['The Weekly Quiz 🧠: fresh Class 8 Maths & Science questions every week, instant scoring, and a dedicated quiz leaderboard. New week = new questions — every Monday!'] },
        { tag: 'security', patterns: ['is my password safe', 'how are passwords stored', 'password security', 'can anyone steal my account', 'hacking'], responses: ['Your password is stored as a one-way hash 🔐 (even the admin can\'t read it). Login happens over HTTPS. Rule #1: never share your password — not even with me!'] },
        { tag: 'offline_detail', patterns: ['what works offline', 'offline features', 'play without internet', 'no net what works', 'net is gone', 'net gone what works', 'does the site work without internet', 'site works without net'], responses: ['Offline mode 📡: already-played games load instantly, opened PDFs stay readable, the site shell works — but chat, scores and live multiplayer need internet.'] },
        { tag: 'site_speed', patterns: ['why is the site so fast', 'how is it so fast', 'site performance', 'does it lag', 'smooth on old phone'], responses: ['Speed secrets ⚡: games load only when you open them (lazy loading), files are compressed, images cached, and the heavy PDF engine only downloads when needed. Built for 2G warriors!'] },
        { tag: 'why_made', patterns: ['why did you make this site', 'site purpose', 'why does this site exist', 'goal of arcade hub'], responses: ['Arcade Hub exists so students can play, chat and study in ONE free place — no ads, no downloads, works on any phone. Made by a student, for students 💖'] },
        { tag: 'future', patterns: ['new games coming', 'future updates', 'what is next', 'upcoming features', 'roadmap'], responses: ['On the horizon 🔭: more games, smarter features, the C++ WASM racer, and me getting smarter with every training! Suggest features via Contact Us — the dev actually listens!'] },
        { tag: 'gk_more', patterns: ['tell me general knowledge', 'gk question', 'interesting knowledge', 'smart fact', 'tell me something new', 'educate me'], responses: ['GK drop 🧠: Octopuses have 3 hearts and blue blood! Honey never spoils — 3000-year-old honey is still edible! A day on Venus is longer than its year! Want more? Just ask again!', 'GK drop 🧠: sharks are older than TREES (400 million vs 350 million years!), bananas are technically berries but strawberries are not, and there are more possible chess games than atoms in the observable universe!', 'GK drop 🧠: honeybees can recognize human faces, an octopus has 9 brains (1 in the head + 1 in each arm), and your body contains enough iron to forge a small nail!'] },
        { tag: 'goodbye_bot', patterns: ['ok bye', 'i have to go', 'going to play now', 'see you later bot', 'class me jaa raha hoon'], responses: ['Go crush those leaderboards 🏆! I\'ll be here — my neurons never sleep!', 'Save my spot on the leaderboard — see you soon! 👋'] },

        { tag: 'sci_light', patterns: ['what is light', 'speed of light', 'rainbow colors', 'why is sky blue', 'reflection refraction of light'], responses: ['Light travels at 299,792 km/s — the cosmic speed limit! The sky is blue because air scatters blue light more (so sunsets are red — light travels through MORE air). Rainbows = light bending through water drops!', 'Light vs sound 📢: light is the fastest thing in the universe, but sound crawls at ~343 m/s in air. Count the seconds between lightning and thunder, divide by 3 — that is the storm distance in km!', 'White light is a blend 🌈 — a prism splits it into 7 colors. Your screen plays the same trick in reverse: every pixel is just red, green and blue turned up and down!'] },
        { tag: 'sci_electricity', patterns: ['what is electricity', 'how does a battery work', 'what is a circuit', 'what is voltage'], responses: ['Electricity ⚡ = tiny electrons flowing through wires, pushed by voltage (the pressure). A battery is a chemical factory that pushes electrons one way. A circuit is the loop they run in!', 'Static shock ⚡: shuffle on a carpet and electrons rub onto you — touch metal and thousands of volts jump at once! Tiny current though, that is why it only stings.', 'Circuit fact 🔌: in a SERIES circuit one dead bulb kills the whole chain; in PARALLEL the rest survive. Your house is wired in parallel — one dead bulb never darkens the home!'] },
        { tag: 'geo_india_more', patterns: ['largest state of india', 'smallest state', 'most populated state', 'rivers of india', 'ganga', 'himalaya facts'], responses: ['India geography 🗺️: largest state → Rajasthan, smallest → Goa, most populated → UP. The Ganga is 2,525 km long. The Himalayas grow ~5mm every year (India is pushing into Asia!)', 'More India geography 🗺️: wettest place on Earth → Mawsynram (Meghalaya!), southernmost tip → Indira Point in the Andamans, and the Thar is the most densely populated desert in the world.', 'River facts 🏞️: the Brahmaputra is called the only MALE river of India, the Godavari is the longest river of the South, and Kanchenjunga — 3rd highest peak on Earth — stands on the Sikkim border!'] },
        { tag: 'math_tables', patterns: ['multiplication table', 'learn tables', 'table sikhao', 'tables trick', 'how to learn tables'], responses: ['Tables trick 🧠: to learn any table, add the number repeatedly! Table of 7: 7, 14, 21, 28... Or ask me to multiply any two numbers — I calculate live!', 'The 9-table lives on your hands ✋: for 9×4, fold your 4th finger — fingers to the left = 3 (tens), to the right = 6 (ones) → 36! Works all the way to 9×10.', 'Shortcut 🧠: any number × 5 = half of that number × 10. So 16×5 → 160÷2 → 80. And 7×8 = 56 — just remember 5,6,7,8 in order!'] },
        { tag: 'health_tips', patterns: ['health tips', 'eye care', 'how to stay healthy', 'screen time', 'back pain from phone'], responses: ['Gamer health 🎮💪: 20-20-20 rule (every 20 min, look 20 feet away for 20 sec), sit straight, blink often, and drink water — your highscore depends on your eyes!', 'More gamer health 💪: sleep 8 hours — memory consolidates while you sleep, stretch your fingers before long sessions, and never play in a fully dark room: keep a lamp ON behind the screen!'] },
        { tag: 'time_management', patterns: ['how to manage time', 'time table', 'procrastination', 'how to stop wasting time'], responses: ['Time mastery ⏰: 1) Make a to-do list the night before. 2) Hardest task FIRST. 3) Phone in another room while studying. 4) 25-min Pomodoro sprints. Future you will thank you!', 'The 2-minute rule ⏰: if a task takes less than 2 minutes, do it NOW instead of remembering it later. And batch similar tasks together — task-switching wastes more time than the tasks themselves!'] },

        { tag: 'thanks', patterns: [
            'thanks', 'thank you', 'thx', 'great', 'awesome', 'nice', 'good bot', 'good job', 'good job bot', 'nice work bot',
            'shukriya', 'dhanyavad', 'perfect', 'love it'
        ], responses: [
            'Anytime! 🎮 Happy gaming — and good luck beating those leaderboards!',
            'You\'re welcome! Anything else about Arcade Hub, just ask. 🤖'
        ] },

        { tag: 'bye', patterns: [
            'bye', 'goodbye', 'see you', 'later', 'exit', 'quit', 'alvida', 'good night'
        ], responses: [
            'Bye! 👋 Come back for the Weekly Quiz — new questions every week!'
        ] }
    ];

    /* per-entity knowledge used by intents with __ENTITY__ responses */
    var GAMES = {
        car:      { names: ['car', 'neon rush', 'real city drift', 'racing', 'race'],
                    info: 'Real City Drift 🏎️ is a neon 3D racing game — dodge traffic, chain near-misses, chase the top score. Keyboard or touch controls.',
                    play: 'Real City Drift controls 🏎️: steer with ←/→ (or A/D), GAS with ↑ (W), BRAKE with ↓ (S). On mobile use the on-screen buttons.' },
        snake:    { names: ['snake', 'snake game', 'worm'],
                    info: 'Snake 🐍 — the classic: eat, grow, don\'t bite yourself. It runs butter-smooth on any phone.',
                    play: 'Snake 🐍 controls: arrow keys (or WASD) on PC; swipe on mobile.' },
        flappy:   { names: ['flappy', 'flappy bird', 'bird'],
                    info: 'Flappy Bird 🐦 — tap through the pipes. Simple to learn, impossible to master. Leaderboard enabled!',
                    play: 'Flappy 🐦 controls: tap/click or press Space to flap.' },
        dino:     { names: ['dino', 'dinosaur', 't-rex', 'chrome dino'],
                    info: 'Dino 🦕 — the famous no-internet dinosaur game, reworked with cloud sync. Jump the cacti!',
                    play: 'Dino 🦕 controls: press Space (or tap) to jump.' },
        pacman:   { names: ['pacman', 'pac man', 'pac-man'],
                    info: 'Pac-Man Reworked ᗧ — smarter ghosts, map openings, leaderboard enabled. Waka waka!',
                    play: 'Pac-Man ᗧ controls: arrow keys to move; swipe on mobile.' },
        ttt:      { names: ['ttt', 'tic tac toe', 'tic-tac-toe', 'xo'],
                    info: 'Tic-Tac-Toe ❌⭕ vs the computer — quick rounds, perfect for a break.',
                    play: 'Tic-Tac-Toe ❌⭕: just tap a square!' },
        multittt: { names: ['tic tac toe online', 'online ttt', 'multiplayer ttt', 'ttt online'],
                    info: 'TTT Online 🎯 — Tic-Tac-Toe against a real friend: create a room, share the code, chat + voice while playing!',
                    play: 'TTT Online 🎯: create a room, share the 4-digit code, tap squares.' },
        multicar: { names: ['car multiplayer', 'car 3d', '3d car', 'multiplayer car', 'car online'],
                    info: 'Car Game 3D 🏎️🏎️ — real-time multiplayer racing with rooms, chat and voice chat.',
                    play: 'Car 3D 🏎️: create/join a room with a code, then steer like the solo car game.' },
        arcadecraft: { names: ['arcadecraft', 'minecraft', 'craft'],
                    info: 'ArcadeCraft ⛏️ — a Minecraft-style world you can play right in the browser!',
                    play: 'ArcadeCraft ⛏️: it opens full-screen — mouse + WASD inside.' },
        rps:      { names: ['rps', 'rock paper scissors', 'stone paper scissors', 'jan ken pon'],
                    info: 'Rock-Paper-Scissors ✊✋✌️ — instant fun against the bot.',
                    play: 'RPS ✊✋✌️: just tap rock, paper or scissors!' },
        quiz:     { names: ['quiz', 'weekly quiz'],
                    info: 'Weekly Quiz 🧠 — Class 8 Maths & Science, fresh questions weekly, with its own leaderboard.',
                    play: 'Quiz 🧠: open Study → Weekly Quiz and hit Start!' }
    };

    /* ═══ CLINC150 HARVEST (premade dataset!) ══════════════════════════
       Real human phrasings from the public CLINC150 intent dataset
       (Larson et al. 2019 — github.com/clinc/oos-eval, MIT license).
       Only general-assistant intents that fit Arcade Hub were kept;
       banking / smart-home / shopping intents were EXCLUDED (wrong domain).
       Generated by harvest.js — do not edit by hand. */
    var CLINC_HARVEST = {
        "greeting": [
            "how's everything",
            "how are things going",
            "hello, anyone there",
            "are you okay right now",
            "are you doing okay",
            "how's it going right now",
            "ahoy hoy",
            "hey there!",
            "how is everything with you",
            "hey hey!",
            "how have you been doing",
            "it's nice to see you",
            "hello there!",
            "how is it going",
            "how are things with you",
            "hiya!",
            "what's up",
            "how're you doing"
        ],
        "bye": [
            "bye-bye",
            "glad we got to talk",
            "nice to speak with you",
            "this was a great conversation",
            "talk to you later",
            "tata for now",
            "i'm out of here",
            "that's all, bye",
            "see ya later",
            "adios ai",
            "nice talking again, bye",
            "sayonara",
            "catch you around",
            "good seeing you",
            "later, thanks for chatting",
            "adios",
            "great talk, take it easy",
            "see ya"
        ],
        "thanks": [
            "i appreciate your help, thank you",
            "i really appreciate your help, thank you",
            "i am very grateful",
            "i appreciate the assistance",
            "i want to thank you for helping",
            "much obliged",
            "your help is appreciated",
            "gracias",
            "i appreciate that",
            "thanks so much!",
            "many thanks",
            "appreciate it",
            "thanks!",
            "i thank you",
            "thank you kindly",
            "thank you so very much",
            "thank you for helping me",
            "i'm grateful to you"
        ],
        "skill_joke": [
            "what do people find funny about food",
            "what are some funny things about food",
            "show me something funny about food",
            "what's a good joke",
            "i'd love to hear a joke",
            "can you tell a joke",
            "would you tell me a joke",
            "how about you tell me a joke",
            "will you tell a joke",
            "please tell me a joke",
            "do you have any jokes",
            "tell me something funny",
            "hit me with a good joke",
            "what's the funniest joke you know",
            "tell me a funny joke",
            "do you know any good jokes",
            "know any jokes",
            "i wanna hear something funny"
        ],
        "who_are_you": [
            "are your real or artificial",
            "am i talking to a real person",
            "am i speaking with someone real",
            "i am not a bot, are you",
            "do you think you are a bot",
            "you sound like a bot",
            "prove that you're a person",
            "are you a bot or a person",
            "are you real or fake",
            "are you ai, or a person",
            "are you a human or a bot",
            "are you real or an ai",
            "are you a bot right now",
            "are you a real human",
            "so are you a real person",
            "so are you human",
            "so are you a bot",
            "are you actually a bot",
            "what's your full name",
            "i didn't get your name",
            "what's should i call you by",
            "can you tell me the ai's name",
            "what is the ai's name",
            "does the ai have a name",
            "what name do you prefer",
            "what are you called",
            "give me your name",
            "what do people call you",
            "what is your full name",
            "tell me your full name",
            "should i call you something in particular",
            "what should i refer to you as",
            "can i have your name please",
            "can you me what they call you",
            "and what would your name be",
            "what name should i use for you"
        ],
        "smalltalk_age": [
            "what is your birthday again",
            "how many years on the earth",
            "what year were you born",
            "how many days old are you",
            "when were you created",
            "what date were you created on",
            "when did you come to exist",
            "how many years do you have",
            "how long have you been alive for",
            "how many years ago was al born",
            "how old is al",
            "what is al's age",
            "you are how old now",
            "what is your birth date",
            "where's your place of birth",
            "where did you grow up",
            "how many years are you",
            "what age are you"
        ],
        "who_made": [
            "who is your employeer",
            "who is the boss of you",
            "i gotta know who is your boss",
            "tell me who is your boss",
            "let me know who is your boss",
            "i wanna know who is your boss",
            "what is the name of your boss",
            "your boss is",
            "are you my worker",
            "are you working for me or what",
            "are you here to serve me",
            "describe who it is you work for",
            "what entity is your boss",
            "you work for who",
            "you work for whom",
            "what's your boss' name",
            "who do you work for",
            "what does your boss go by"
        ],
        "smalltalk_fav": [
            "what kinds of things are you into",
            "what's your favorite hobby",
            "what do you do for fun",
            "do you have any hobbies",
            "do you have any past-times",
            "what things do you like to do",
            "what are your favorite hobbies",
            "what are your favorite things to do",
            "what are ai's hobbies",
            "i'd like to know your hobbies",
            "let's talk about your hobbies",
            "can you tell me about your hobbies",
            "tell me your hobbies",
            "what are you hobbies",
            "what hobbies do you do",
            "how do you spend your spare time",
            "what are some things you like doing",
            "can you describe your hobbies to me"
        ],
        "off_topic": [
            "does life have meaning",
            "is being alive the meaning of life",
            "what is the real meaning of life",
            "does life have a meaning",
            "what makes life have any meaning",
            "why do you think we're here",
            "what's the answer to existence",
            "what's the point of sentience",
            "what's the purpose of existence",
            "what's the purpose of life",
            "what is life's meaning",
            "is there a greater purpose in life",
            "what is our purpose in life",
            "how is life in existence",
            "what's lifes meaning",
            "what exactly is the meaning of life",
            "whats lifes meaning exactly",
            "what's the meaning of this life"
        ],
        "smalltalk_origin": [
            "where is your place of origin",
            "what is your place of origin",
            "what is your country of origin",
            "where is your country of origin",
            "what is your nationality",
            "tell me where you're made",
            "tell me how you're made",
            "what town were you born in",
            "what country were you born in",
            "where's your birthplace",
            "you were born where",
            "your birthplace is where",
            "where are your origins located",
            "where did you originate from",
            "where is your home located",
            "where do you trace your roots",
            "where do you hail from",
            "i'd like to know where you're from"
        ],
        "smalltalk_pets": [
            "what type of pet do you have",
            "do you have any type of pet",
            "do you own pets",
            "describe your types of pets",
            "what are the pet types you own",
            "do you have any pet animals",
            "any pets in your household",
            "do you have any domestic animals",
            "which animals do you have at home",
            "specifically, what pets do you own",
            "what is your favorite, cats or dogs",
            "which food do you give your pets",
            "how old are your pets",
            "the pets are all good",
            "what is the colour of your pets",
            "what is your favourite pet",
            "what kind of pets live with you",
            "how many different pets do you have"
        ]
    };
    Object.keys(CLINC_HARVEST).forEach(function (tag) {
        for (var hi = 0; hi < INTENTS.length; hi++) if (INTENTS[hi].tag === tag) {
            INTENTS[hi].patterns = INTENTS[hi].patterns.concat(CLINC_HARVEST[tag]);
            break;
        }
    });
    INTENTS.push({ tag: 'smalltalk_origin', patterns: ["where is your place of origin","what is your place of origin","what is your country of origin","where is your country of origin","what is your nationality","tell me where you're made","tell me how you're made","what town were you born in","what country were you born in","where's your birthplace","you were born where","your birthplace is where","where are your origins located","where did you originate from","where is your home located","where do you trace your roots","where do you hail from","i'd like to know where you're from","where do you live","where do you stay"],
        responses: [
            "I live right here in the chat — one message away, rent-free and always awake! 🏠",
            "Home is where the WiFi is… but my real home is Arcade Hub! 🎮 Come visit anytime!"
    ] });
    INTENTS.push({ tag: 'smalltalk_pets', patterns: ["what type of pet do you have","do you have any type of pet","do you own pets","describe your types of pets","what are the pet types you own","do you have any pet animals","any pets in your household","do you have any domestic animals","which animals do you have at home","specifically, what pets do you own","what is your favorite, cats or dogs","which food do you give your pets","how old are your pets","the pets are all good","what is the colour of your pets","what is your favourite pet","what kind of pets live with you","how many different pets do you have","do you have a pet","got any pets"],
        responses: [
            "Yes! A pet Snake 🐍 — it lives in the games folder and keeps eating my highscores!",
            "I tried adopting a Pac-Man ghost 👻 but it kept eating my data packets. So… just the Snake!"
    ] });

    /* ═══ KNOWLEDGE PACK v5.2 ═══════════════════════════════════════════
       21 new intents (history, sports, Class 8 science/math/geography,
       computers, inventions, grammar + QUIZ MODE) and Hinglish patterns.
       QUIZ bank: 94 questions from the Open Trivia DB
       (opentdb.com — free to use). Generated by the v5.2 build script. */
    var QUIZ = [
     {
      "q": "In what year did Halley's Comet, which will not appear again until the year 2061, previously approach Earth?",
      "options": [
       "1942",
       "1909",
       "1986",
       "2001"
      ],
      "correct": 2
     },
     {
      "q": "What is the Zodiac symbol for Gemini?",
      "options": [
       "Scales",
       "Maiden",
       "Fish",
       "Twins"
      ],
      "correct": 3
     },
     {
      "q": "Which chemical element, number 11 in the Periodic table, has the symbol Na?",
      "options": [
       "Lead",
       "Nitrogen",
       "Sodium",
       "Carbon"
      ],
      "correct": 2
     },
     {
      "q": "Which of these Indian languages is not part of the Indo-European language family?",
      "options": [
       "Hindi",
       "Tamil",
       "Punjabi",
       "Urdu"
      ],
      "correct": 1
     },
     {
      "q": "Which country drives on the left side of the road?",
      "options": [
       "Japan",
       "Germany",
       "China",
       "Russia"
      ],
      "correct": 0
     },
     {
      "q": "If someone said \"you are olid\", what would they mean?",
      "options": [
       "Your appearance is repulsive.",
       "You are out of shape/weak.",
       "You are incomprehensible/an idiot.",
       "You smell extremely unpleasant."
      ],
      "correct": 3
     },
     {
      "q": "Which logical fallacy means to attack the character of your opponent rather than their arguments?",
      "options": [
       "Ad hominem",
       "Post hoc ergo propter hoc",
       "Tu quoque",
       "Argumentum ad populum"
      ],
      "correct": 0
     },
     {
      "q": "What is the name of Poland in Polish?",
      "options": [
       "Polszka",
       "P&oacute;land",
       "Pupcia",
       "Polska"
      ],
      "correct": 3
     },
     {
      "q": "What is the name of the antagonist group in Danganronpa Another Episode: Ultra Despair Girls?",
      "options": [
       "The Monokubs",
       "Warriors of Hope",
       "Warriors of Despair",
       "The Ultimate Despair"
      ],
      "correct": 1
     },
     {
      "q": "In \"Katamari Damacy\", you control a character known as:",
      "options": [
       "Ichigo",
       "The Prince",
       "Fujio",
       "Foomin"
      ],
      "correct": 1
     },
     {
      "q": "Which of these words refers to something made, distributed, or sold illegally?",
      "options": [
       "Bootstrap",
       "Bootlace",
       "Bootblack",
       "Bootleg"
      ],
      "correct": 3
     },
     {
      "q": "What does the \"G\" mean in \"G-Man\"?",
      "options": [
       "Going",
       "Government",
       "Ghost",
       "Geronimo"
      ],
      "correct": 1
     },
     {
      "q": "Bob and Mike Bryan were well known brothers in which sport?",
      "options": [
       "Tennis",
       "Basketball",
       "Baseball",
       "Football"
      ],
      "correct": 0
     },
     {
      "q": "Before the 19th Century, the \"Living Room\" was originally called the...",
      "options": [
       "Open Room",
       "Parlor",
       "Loft",
       "Sitting Room"
      ],
      "correct": 1
     },
     {
      "q": "What step in cellular respiration forms ATP?",
      "options": [
       "Glycolysis",
       "Pyruvate Oxidation",
       "Calvin Cycle",
       "Oxidative Phosphorylation"
      ],
      "correct": 3
     },
     {
      "q": "What English word means to \"think deeply\"?",
      "options": [
       "Condensate",
       "Confiscate",
       "Constipate",
       "Contemplate"
      ],
      "correct": 3
     },
     {
      "q": "Which is the capital of Spain?",
      "options": [
       "Barcelona",
       "Madrid",
       "Paris",
       "Lisboa"
      ],
      "correct": 1
     },
     {
      "q": "What technology is named after a tenth-century ruler of Denmark and Norway?",
      "options": [
       "Internet",
       "GPS",
       "Bluetooth",
       "Wi-Fi"
      ],
      "correct": 2
     },
     {
      "q": "In human biology, a circadium rhythm relates to a period of roughly how many hours?",
      "options": [
       "24",
       "32",
       "16",
       "8"
      ],
      "correct": 0
     },
     {
      "q": "What is the scientific name for the extinct hominin known as \"Lucy\"?",
      "options": [
       "Australopithecus Antaris",
       "Australopithecus Africanus",
       "Australopithecus Architeuthis",
       "Australopithecus Afarensis"
      ],
      "correct": 3
     },
     {
      "q": "What is the chemical formula for ammonia?",
      "options": [
       "CH4",
       "NO3",
       "NH3",
       "CO2"
      ],
      "correct": 2
     },
     {
      "q": "What is \"Stenoma\"?",
      "options": [
       "A type of seasoning",
       "A combat stimulant from WW2",
       "A genus of moths",
       "A port city in the carribean"
      ],
      "correct": 2
     },
     {
      "q": "About how old is Earth?",
      "options": [
       "4.5 Billion Years",
       "2.5 Billion Years",
       "3.5 Billion Years",
       "5.5 Billion Years"
      ],
      "correct": 0
     },
     {
      "q": "Which element has the highest melting point?",
      "options": [
       "Platinum",
       "Osmium",
       "Carbon",
       "Tungsten"
      ],
      "correct": 2
     },
     {
      "q": "Which Landsat Satellite failed to reach orbit?",
      "options": [
       "Landsat 4",
       "Landsat 5",
       "Landsat 3",
       "Landsat 6"
      ],
      "correct": 3
     },
     {
      "q": "Folic acid is the synthetic form of which vitamin?",
      "options": [
       "Vitamin D",
       "Vitamin B",
       "Vitamin A",
       "Vitamin C"
      ],
      "correct": 1
     },
     {
      "q": "How much radiation does a banana emit?",
      "options": [
       "0.7 Microsievert",
       "0.3 Microsievert",
       "0.5 Microsievert",
       "0.1 Microsievert"
      ],
      "correct": 3
     },
     {
      "q": "What name is given to all baby marsupials?",
      "options": [
       "Joey",
       "Calf",
       "Pup",
       "Cub"
      ],
      "correct": 0
     },
     {
      "q": "Autosomal-dominant Compelling Helio-Ophthalmic Outburst syndrome is the need to do what when seeing the Sun?",
      "options": [
       "Hiccup",
       "Yawn",
       "Sneeze",
       "Cough"
      ],
      "correct": 2
     },
     {
      "q": "Which of these Elements is a metalloid?",
      "options": [
       "Antimony",
       "Rubidium",
       "Tin",
       "Bromine"
      ],
      "correct": 0
     },
     {
      "q": "What is the common name of the chemical compound \"dihydrogen monoxide\"?",
      "options": [
       "Laughing Gas",
       "Water",
       "Ammonia",
       "Methane"
      ],
      "correct": 1
     },
     {
      "q": "What causes the sound of a heartbeat?",
      "options": [
       "Blood exiting the heart",
       "Contraction of the heart chambers",
       "Relaxation of the heart chambers",
       "Closure of the heart valves"
      ],
      "correct": 3
     },
     {
      "q": "Which of these stars is the largest?",
      "options": [
       "VY Canis Majoris",
       "UY Scuti",
       "Betelgeuse",
       "RW Cephei"
      ],
      "correct": 1
     },
     {
      "q": "The Sun consists of mostly which two elements?",
      "options": [
       "Carbon & Helium",
       "Carbon & Nitrogen",
       "Hydrogen & Helium",
       "Hydrogen & Nitrogen"
      ],
      "correct": 2
     },
     {
      "q": "What is the chemical symbol for lead?",
      "options": [
       "Ld",
       "Pb",
       "Le",
       "Pm"
      ],
      "correct": 1
     },
     {
      "q": "The medical term for the belly button is which of the following?",
      "options": [
       "Nares",
       "Umbilicus",
       "Paxillus",
       "Nevus"
      ],
      "correct": 1
     },
     {
      "q": "What is the Linnean name of the domestic apple tree?",
      "options": [
       "Pomus domestica",
       "Appelus delectica",
       "Malus pumila",
       "Malus americana"
      ],
      "correct": 2
     },
     {
      "q": "In Chemistry, how many isomers does Butanol (C4H9OH) have?",
      "options": [
       "5",
       "4",
       "6",
       "3"
      ],
      "correct": 1
     },
     {
      "q": "Who won the premier league title in the 2015-2016 season following a fairy tale run?",
      "options": [
       "Leicester City",
       "Tottenham Hotspur",
       "Stoke City",
       "Watford"
      ],
      "correct": 0
     },
     {
      "q": "Which NBA player won Most Valuable Player for the 1999-2000 season?",
      "options": [
       "Allen Iverson",
       "Paul Pierce",
       "Shaquille O'Neal",
       "Kobe Bryant"
      ],
      "correct": 2
     },
     {
      "q": "Which soccer team won the Copa América Centenario 2016?",
      "options": [
       "Colombia",
       "Chile",
       "Brazil",
       "Argentina"
      ],
      "correct": 1
     },
     {
      "q": "Who was the topscorer for England national football team?",
      "options": [
       "Wayne Rooney",
       "David Beckham",
       "Steven Gerrard",
       "Michael Owen"
      ],
      "correct": 0
     },
     {
      "q": "Who is often called \"the Maestro\" in the men's tennis circuit?",
      "options": [
       "Bill Tilden",
       "Boris Becker",
       "Roger Federer",
       "Pete Sampras"
      ],
      "correct": 2
     },
     {
      "q": "Who was the British professional wrestler Shirley Crabtree better known as?",
      "options": [
       "Big Daddy",
       "Masambula",
       "Giant Haystacks",
       "Kendo Nagasaki"
      ],
      "correct": 0
     },
     {
      "q": "Which sport is NOT traditionally played during the Mongolian Naadam festival?",
      "options": [
       "American Football",
       "Wrestling",
       "Archery",
       "Horse-Racing"
      ],
      "correct": 0
     },
     {
      "q": "What team won the 2016 MLS Cup?",
      "options": [
       "Seattle Sounders",
       "Toronto FC",
       "Montreal Impact",
       "Colorado Rapids"
      ],
      "correct": 0
     },
     {
      "q": "Which female player won the gold medal of table tennis singles in 2016 Olympics Games?",
      "options": [
       "Ai FUKUHARA (Japan)",
       "Song KIM (North Korea)",
       "LI Xiaoxia (China)",
       "DING Ning (China)"
      ],
      "correct": 3
     },
     {
      "q": "What national team won the 2016 edition of UEFA European Championship?",
      "options": [
       "France",
       "Portugal",
       "Germany",
       "England"
      ],
      "correct": 1
     },
     {
      "q": "How many times did Martina Navratilova win the Wimbledon Singles Championship?",
      "options": [
       "Eight",
       "Ten",
       "Nine",
       "Seven"
      ],
      "correct": 2
     },
     {
      "q": "In what sport is a \"shuttlecock\" used?",
      "options": [
       "Cricket",
       "Badminton",
       "Table Tennis",
       "Rugby"
      ],
      "correct": 1
     },
     {
      "q": "The 1988 Formula 1 season had McLaren win all but one race, what race did they not win?",
      "options": [
       "Brazilian Grand Prix",
       "Italian Grand Prix",
       "Japanese Grand Prix",
       "Monaco Grand Prix"
      ],
      "correct": 1
     },
     {
      "q": "The Los Angeles Dodgers were originally from what U.S. city?",
      "options": [
       "Brooklyn",
       "Las Vegas",
       "Boston",
       "Seattle"
      ],
      "correct": 0
     },
     {
      "q": "In Formula 1, the Virtual Safety Car was introduced following the fatal crash of which driver?",
      "options": [
       "Jules Bianchi",
       "Gilles Villeneuve",
       "Ayrton Senna",
       "Ronald Ratzenberger"
      ],
      "correct": 0
     },
     {
      "q": "Who won NFL Super Bowl LI? (51)",
      "options": [
       "Patriots",
       "Broncos",
       "Falcons",
       "Eagles"
      ],
      "correct": 0
     },
     {
      "q": "Who won the UEFA Champions League in 2017?",
      "options": [
       "Juventus F.C.",
       "AS Monaco FC",
       "Atletico Madrid",
       "Real Madrid C.F."
      ],
      "correct": 3
     },
     {
      "q": "How many premier league trophies did Sir Alex Ferguson win during his time at Manchester United?",
      "options": [
       "11",
       "22",
       "20",
       "13"
      ],
      "correct": 3
     },
     {
      "q": "The Pyrenees mountains are located on the border of which two countries?",
      "options": [
       "Norway and Sweden",
       "France and Spain",
       "Italy and Switzerland",
       "Russia and Ukraine"
      ],
      "correct": 1
     },
     {
      "q": "What is the area of Vatican City?",
      "options": [
       "12.00km^2",
       "0.44km^2",
       "0.10km^2",
       "0.86km^2"
      ],
      "correct": 1
     },
     {
      "q": "What is the capital of India?",
      "options": [
       "Montreal",
       "New Delhi",
       "Tithi",
       "Beijing"
      ],
      "correct": 1
     },
     {
      "q": "How many countries border Kyrgyzstan?",
      "options": [
       "3",
       "1",
       "6",
       "4"
      ],
      "correct": 3
     },
     {
      "q": "Where is Fort Marlborough located?",
      "options": [
       "London",
       "Bengkulu",
       "Dover",
       "Singapore"
      ],
      "correct": 1
     },
     {
      "q": "Which is not a country in Africa?",
      "options": [
       "Guyana",
       "Senegal",
       "Liberia",
       "Somalia"
      ],
      "correct": 0
     },
     {
      "q": "Which state of the United States is the smallest?",
      "options": [
       "Massachusetts",
       "Rhode Island",
       "Vermont",
       "Maine"
      ],
      "correct": 1
     },
     {
      "q": "What is the capital of Ecuador?",
      "options": [
       "Quito",
       "Bogota",
       "Santiago",
       "Santa Fé"
      ],
      "correct": 0
     },
     {
      "q": "What is the county seat of King County, Washington?",
      "options": [
       "Seattle",
       "Bellevue",
       "Skykomish",
       "Enumclaw"
      ],
      "correct": 0
     },
     {
      "q": "The Suez Canal is located in which African country?",
      "options": [
       "Nigeria",
       "Ghana",
       "Egypt",
       "Libya"
      ],
      "correct": 2
     },
     {
      "q": "What colour is the circle on the Japanese flag?",
      "options": [
       "Yellow",
       "Black",
       "White",
       "Red"
      ],
      "correct": 3
     },
     {
      "q": "All of the following countries have official claims to territory in Antartica EXCEPT:",
      "options": [
       "United States",
       "Chile",
       "Australia",
       "Norway"
      ],
      "correct": 0
     },
     {
      "q": "Which of the following countries is within the Eurozone but outside of the Schengen Area?",
      "options": [
       "Portugal",
       "Cyprus",
       "Greece",
       "Malta"
      ],
      "correct": 1
     },
     {
      "q": "Which of these is the name of the largest city in the US state Tennessee?",
      "options": [
       "Memphis",
       "Luxor",
       "Alexandria",
       "Thebes"
      ],
      "correct": 0
     },
     {
      "q": "What is the official language of Costa Rica?",
      "options": [
       "English",
       "Spanish",
       "Portuguese",
       "Creole"
      ],
      "correct": 1
     },
     {
      "q": "How many timezones does Russia have?",
      "options": [
       "11",
       "6",
       "24",
       "16"
      ],
      "correct": 0
     },
     {
      "q": "On which continent does the Andes mountain range lie?",
      "options": [
       "Asia",
       "Europe",
       "South America",
       "Africa"
      ],
      "correct": 2
     },
     {
      "q": "Which of the following countries banned the use of personal genetic ancestry tests?",
      "options": [
       "Austria",
       "Germany",
       "Sweden",
       "Canada"
      ],
      "correct": 1
     },
     {
      "q": "How many stations does the Central Line have on the London Underground?",
      "options": [
       "43",
       "47",
       "49",
       "51"
      ],
      "correct": 2
     },
     {
      "q": "Bikini Atoll is in which country?",
      "options": [
       "Bahamas",
       "Christmas Islands",
       "Fiji",
       "Marshall Islands"
      ],
      "correct": 3
     },
     {
      "q": "Which of the following snipers has the highest amount of confirmed kills?",
      "options": [
       "Craig Harrison",
       "Simo H&auml;yh&auml;",
       "Chris Kyle",
       "Vasily Zaytsev"
      ],
      "correct": 1
     },
     {
      "q": "In 1939, Britain and France declared war on Germany after it invaded which country?",
      "options": [
       "Poland",
       "Austria",
       "Hungary",
       "Czechoslovakia"
      ],
      "correct": 0
     },
     {
      "q": "What was the name of the chemical that was dropped on Vietnam during the Vietnam war?",
      "options": [
       "Mustard Gas",
       "Phosgene",
       "Hydrogen Cyanide",
       "Agent Orange"
      ],
      "correct": 3
     },
     {
      "q": "What year were the Marian Reforms instituted in the Roman Republic?",
      "options": [
       "42 BCE",
       "107 BCE",
       "264 BCE",
       "102 CE"
      ],
      "correct": 1
     },
     {
      "q": "Where was Abraham Lincoln when he was assassinated by John Wilkes Booth in 1865?",
      "options": [
       "In bed",
       "On a boat",
       "On his horse",
       "At the theatre"
      ],
      "correct": 3
     },
     {
      "q": "Who was the last Roman emperor in the Year of Four Emperors (69 AD)?",
      "options": [
       "Vitellius",
       "Vespasian",
       "Otho",
       "Galba"
      ],
      "correct": 1
     },
     {
      "q": "When did the British hand-over sovereignty of Hong Kong back to China?",
      "options": [
       "1997",
       "1999",
       "1900",
       "1841"
      ],
      "correct": 0
     },
     {
      "q": "Which of these landmarks is not included in the original 'Seven Wonders of the Ancient World'?",
      "options": [
       "Great Wall of China",
       "Great Pyramid of Giza",
       "Hanging Gardens of Babylon",
       "Colossus of Rhodes"
      ],
      "correct": 0
     },
     {
      "q": "What was the name commonly given to the ancient trade routes that connected the East and West of Eurasia?",
      "options": [
       "Silk Road",
       "Clay Road",
       "Spice Road",
       "Salt Road"
      ],
      "correct": 0
     },
     {
      "q": "Who discovered Penicillin?",
      "options": [
       "Louis Pasteur",
       "Alfred Nobel",
       "Marie Curie",
       "Alexander Flemming"
      ],
      "correct": 3
     },
     {
      "q": "Pol Pot was the former dictator of which country?",
      "options": [
       "Laos",
       "North Korea",
       "Vietnam",
       "Cambodia"
      ],
      "correct": 3
     },
     {
      "q": "Who rode on horseback to warn the Minutemen that the British were coming during the U.S. Revolutionary War?",
      "options": [
       "Nathan Hale",
       "Thomas Paine",
       "Henry Longfellow",
       "Paul Revere"
      ],
      "correct": 3
     },
     {
      "q": "Which of the following ancient Near Eastern peoples still exists as a modern ethnic group?",
      "options": [
       "Babylonians",
       "Hittites",
       "Elamites",
       "Assyrians"
      ],
      "correct": 3
     },
     {
      "q": "Which of these founding fathers of the United States of America later became president?",
      "options": [
       "Alexander Hamilton",
       "James Monroe",
       "Samuel Adams",
       "Roger Sherman"
      ],
      "correct": 1
     },
     {
      "q": "In what year did Texas secede from Mexico?",
      "options": [
       "1844",
       "1845",
       "1836",
       "1838"
      ],
      "correct": 2
     },
     {
      "q": "Which one of these tanks was designed and operated by the United Kingdom?",
      "options": [
       "M4 Sherman",
       "Tiger H1",
       "Tog II",
       "T-34"
      ],
      "correct": 2
     },
     {
      "q": "What was the bloodiest single-day battle during the American Civil War?",
      "options": [
       "The Battle of Antietam",
       "The Battles of Chancellorsville",
       "The Siege of Vicksburg",
       "The Battle of Gettysburg"
      ],
      "correct": 0
     },
     {
      "q": "In what year did the Berlin Wall fall?",
      "options": [
       "1991",
       "1993",
       "1989",
       "1987"
      ],
      "correct": 2
     }
    ];
    var HINGLISH_EXTRA = {"greeting":["hello ji","namaste ji"],"bye":["phir milenge","chalta hoon","tata bye bye"],"thanks":["thanks yaar","thanks bhai"],"skill_joke":["hasao mujhe","ek joke sunao yaar","comedy kar"],"study_fact":["kuch interesting batao","gyaan baanto","koi fact sunao"],"is_free":["kya ye free hai","paisa lagta hai kya"],"list_games":["kaun se games hain","game batao","games ki list do"],"how_to_play":["kaise khelte hain","kaise khelein","controls batao"],"who_are_you":["tum kaun ho","tumhara naam kya hai"],"who_made":["tumhe kisne banaya","site kisne banayi"],"friends_chat":["dost kaise add karein","friend kaise banaye"],"skill_quizme":["quiz khilao","sawaal poocho","gk sawaal poocho"],"site_stats":["kitne users hain","kitne log khelte hain"]};
    Object.keys(HINGLISH_EXTRA).forEach(function (tag) {
        for (var hi = 0; hi < INTENTS.length; hi++) if (INTENTS[hi].tag === tag) {
            INTENTS[hi].patterns = INTENTS[hi].patterns.concat(HINGLISH_EXTRA[tag]);
            break;
        }
    });
    INTENTS.push({ tag: "hist_india", patterns: ["indian history","tell me about indian history","history of india","india history","bharat ka itihas","indian history timeline","important events in indian history"],
        responses: ["🇮🇳 **India through time:**\n- **Harappan civilization** — one of the OLDEST urban cultures (~4,600 years ago!)\n- **Ashoka** — the emperor who chose peace after the Kalinga war\n- **1857** — the first big war of independence\n- **1947** — freedom, led by Gandhi, Nehru, Patel and millions more\n\nWant more? Say **more**!","🇮🇳 **Freedom struggle heroes:**\n- **Gandhi** — non-violence (satyagraha) as a weapon\n- **Bhagat Singh** — revolution at just 23\n- **Rani Lakshmibai** — the warrior queen of Jhansi\n- **Subhas Chandra Bose** — led the Azad Hind Fauj\n\nClass 8 history gold!"] });
    INTENTS.push({ tag: "hist_world", patterns: ["world war 1","world war 2","world history","who was hitler","cold war","world wars","world war facts","tell me about the wars","history of the world"],
        responses: ["🌍 **World history speed-run:**\n- **Egypt** — pyramids built ~4,500 years ago, without machines!\n- **Roman empire** — roads, laws, and Latin (root of many languages)\n- **French Revolution (1789)** — liberty, equality, fraternity\n- **World Wars** — WWI (1914-18) and WWII (1939-45), the deadliest conflicts ever\n\nHistory = the biggest story ever told!"] });
    INTENTS.push({ tag: "sports_cricket", patterns: ["cricket rules","how many players in cricket","what is a googly","ipl teams","world cup cricket","who is virat kohli","what is lbw","cricket basics","how to play cricket","sixer meaning","cricket records"],
        responses: ["🏏 **Cricket 101:**\n- **11 players** per side\n- **1 over = 6 balls**\n- **LBW** — leg before wicket\n- **Googly** — a spinner trick: looks like one spin, turns the other!\n\nIPL + World Cup = the two biggest festivals! Want more? Say **more**!","🏏 **Cricket records:**\n- Highest ODI score ever: **264** — Rohit Sharma!\n- India won the ODI World Cup **twice** (1983, 2011)\n- Sachin = the God of Cricket — **100 international centuries**!\n\nBowled you over? Say **more**!"] });
    INTENTS.push({ tag: "sports_general", patterns: ["kabaddi","sports day","sports facts","general sports questions","tell me about sports","other sports"],
        responses: ["🏅 **Sports smarts:**\n- India national game: **hockey** — 8 Olympic golds!\n- **Kabaddi** — born in India, now a pro league\n- **Football:** 11 players, 90 minutes, 1 glorious ball\n- **Olympics:** every 4 years — modern games began 1896\n\nSay **more** for extra sports facts!"] });
    INTENTS.push({ tag: "sci_respiration", patterns: ["what is respiration","difference between breathing and respiration","aerobic respiration","anaerobic respiration","why do we respire","respiration in plants","what is atp"],
        responses: ["🫁 **Respiration (Class 8):**\n- **Breathing** = just moving air in and out\n- **Respiration** = cells BREAKING DOWN food to release energy (ATP!)\n- **Aerobic** = with oxygen · **Anaerobic** = without (that is why muscles cramp after a sprint!)\n- Plants respire too — day AND night!"] });
    INTENTS.push({ tag: "sci_reproduction", patterns: ["reproduction in plants","pollination","what is pollination","explain pollination","explain pollination to me","tell me about pollination","what is fertilization","asexual reproduction","how do plants reproduce","types of reproduction","binary fission","budding in yeast","reproduction in animals"],
        responses: ["🌱 **Reproduction basics (Class 8):**\n- **Sexual** = two parents (pollination → fertilization → seed)\n- **Asexual** = one parent (binary fission in amoeba, budding in yeast!)\n- **Pollination** = pollen travelling flower to flower — bees are the delivery service 🐝\n\nLife finds a way — literally!"] });
    INTENTS.push({ tag: "sci_metals", patterns: ["metals and non metals","properties of metals","what is malleable","ductile meaning","examples of non metals","what is an alloy","uses of metals","difference between metal and non metal"],
        responses: ["⚙️ **Metals vs non-metals (Class 8):**\n- **Metals:** shiny, malleable (beaten into sheets), ductile (drawn into wires), conduct heat + electricity\n- **Non-metals:** dull and brittle — sulfur, carbon, oxygen\n- **Alloys** = metal mixtures: steel = iron + carbon, brass = copper + zinc!"] });
    INTENTS.push({ tag: "sci_fossil_fuel", patterns: ["what are fossil fuels","coal formation","what is coal","uses of coal","where does coal come from","petroleum","natural gas","why are they called fossil fuels","products of coal"],
        responses: ["🛢️ **Fossil fuels (Class 8):**\n- **Coal, petroleum, natural gas** — from dead organisms over MILLIONS of years\n- Fossil = they come from ancient life, buried energy!\n- **Renewables** never run out: solar, wind, hydro ♻️\n- Coal gives us coke, coal tar and coal gas on heating"] });
    INTENTS.push({ tag: "sci_micro", patterns: ["what are microorganisms","what are germs","are germs bad","friendly microorganisms","bacteria and virus","what is a vaccine","who discovered penicillin","pasteurization","friendly bacteria","what is fungus","diseases caused by microorganisms","are all bacteria harmful"],
        responses: ["🦠 **Microorganisms: friend AND foe (Class 8):**\n- **Friends:** curd (bacteria!), antibiotics (penicillin — Alexander Fleming!), nitrogen-fixing bacteria, yeast in bread\n- **Foes:** TB, cholera, malaria (protozoa), viruses like COVID\n- **Vaccines** = training your immune army with a weakened enemy 💉\n- **Pasteurization** = heating milk to kill germs — Louis Pasteur!"] });
    INTENTS.push({ tag: "sci_friction", patterns: ["what is friction","advantages of friction","disadvantages of friction","why do we slip on banana peel","what is force","types of force","what is pressure","force and pressure","why do we slip on wet floors"],
        responses: ["🧲 **Force, friction & pressure (Class 8):**\n- **Force** = push or pull (changes speed, direction, shape)\n- **Friction** = the invisible grip between surfaces — helps you walk, wastes energy in engines\n- **Less friction** = banana-peel slips 🍌, ice, wet floors\n- **Pressure** = force ÷ area — why sharp knives cut and camel feet do not sink!"] });
    INTENTS.push({ tag: "sci_light_eye", patterns: ["parts of the eye","how do we see","what is reflection","laws of reflection","plane mirror","what is myopia","human eye parts","what is the iris","blind spot in eye","how does the eye work"],
        responses: ["👁️ **The human eye + light (Class 8):**\n- **Iris** controls light entry · **retina** = the screen · **optic nerve** = the cable to your brain\n- **Reflection:** angle in = angle out\n- **Myopia** = near-sightedness — fixed with a concave lens\n- We see because light bounces OFF things into our eyes!"] });
    INTENTS.push({ tag: "math_algebra", patterns: ["what is algebra","what is a variable","simple equations","how to solve equations","linear equation","algebra basics","explain what a variable is"],
        responses: ["📝 **Algebra basics (Class 8):**\n- A **variable** = a mystery number (x)\n- An **equation** = a balance scale: do the same thing to BOTH sides!\n- Example: x + 3 = 10 → subtract 3 from both sides → **x = 7**\n\nGive me a sum to calculate — I do it LIVE! 🧮"] });
    INTENTS.push({ tag: "math_geometry", patterns: ["types of angles","what is a polygon","properties of triangle","quadrilateral types","what is a right angle","sum of angles of triangle","what is a parallelogram","geometry basics"],
        responses: ["📐 **Geometry starter pack:**\n- **Angles:** acute (<90°), right (=90°), obtuse (>90°), straight (180°)\n- **Triangle angles always add to 180°!** Quadrilaterals: 360°\n- **Parallelogram** = opposite sides parallel AND equal\n- Polygons: triangle (3 sides) → pentagon (5) → octagon (8)"] });
    INTENTS.push({ tag: "math_ratios", patterns: ["what is ratio","ratio meaning","what does ratio mean","what is proportion","percentage basics","how to calculate percentage","direct proportion","inverse proportion","profit and loss","how do i calculate percentages"],
        responses: ["💯 **Ratio, proportion, percentage:**\n- **Ratio** = comparison (3:2)\n- **Proportion** = two equal ratios (a : b :: c : d)\n- **Percentage** = parts per 100 — 45/100 = 45%\n- **Profit %** = (profit ÷ cost) × 100\n\nI calculate these LIVE — try \"what is 15 percent of 80\"!"] });
    INTENTS.push({ tag: "geo_layers", patterns: ["inside the earth","layers of earth","what causes earthquakes","what is a volcano","why do earthquakes happen","crust mantle core","what is a tsunami","what is inside our planet"],
        responses: ["🌍 **Inside the Earth (Class 8 geo):**\n- **Crust** (thin skin) → **Mantle** (hot, slowly-flowing rock) → **Core** (iron + nickel, ~5,000°C!)\n- **Earthquakes** = tectonic plates suddenly slipping — seismic waves!\n- **Volcanoes** = magma escaping through weak spots\n- **Tsunami** = an undersea earthquake pushing giant waves"] });
    INTENTS.push({ tag: "geo_weather", patterns: ["what is climate","difference between weather and climate","monsoon in india","what does monsoon mean","seasons of india","weather report types"],
        responses: ["🌦️ **Weather vs climate:**\n- **Weather** = today mood (changes daily)\n- **Climate** = personality (the ~30-year average)\n- **Monsoon** = the seasonal wind that gives India most of its rain!\n- **Greenhouse effect** = gases trapping heat — extra gases = global warming 🌡️"] });
    INTENTS.push({ tag: "geo_agriculture", patterns: ["what is agriculture","types of farming","rabi and kharif crops","major crops of india","what is sericulture","what is horticulture","which crops grow in winter in india"],
        responses: ["🌾 **Agriculture (Class 8 geo):**\n- **Rabi crops** = winter (wheat, mustard) · **Kharif** = monsoon (rice, maize!)\n- India = world 2nd largest producer of rice AND wheat\n- **Sericulture** = silk farming (silkworms!) · **Horticulture** = fruits + vegetables\n- **Subsistence farming** = for family · **commercial** = for market"] });
    INTENTS.push({ tag: "comp_terms", patterns: ["what is a browser","what is an operating system","what is a pdf","what is a download","what does an operating system do","what is software hardware"],
        responses: ["💻 **Computer terms decoded:**\n- **Browser** = the app that shows websites (Chrome!)\n- **OS** = the boss of the machine — Android, Windows, iOS\n- **WiFi** = wireless internet at home · **mobile data** = internet from the tower\n- **PDF** = a print-style document — perfect for study material!\n- **Cloud** = your files stored on far-away servers, ready anywhere"] });
    INTENTS.push({ tag: "inventions", patterns: ["who invented the telephone","who invented the light bulb","who invented the airplane","who invented the radio","who made the first computer","who invented printing","invention of the internet","who discovered electricity","famous inventions","who invented the lightbulb"],
        responses: ["💡 **Invention hall of fame:**\n- **Telephone** — Alexander Graham Bell (1876)\n- **Light bulb** — Thomas Edison (after 1,000 failed tries!)\n- **Airplane** — the Wright brothers (1903 — 12 seconds that changed the world)\n- **WWW** — Tim Berners-Lee (1989) — and he gave it away FREE\n- **Zero** — India! 🇮🇳"] });
    INTENTS.push({ tag: "english_grammar", patterns: ["what is a noun","what is a verb","what is an adjective","tenses in english","what is a pronoun","active and passive voice","what is a preposition","direct and indirect speech","what is a noun in english"],
        responses: ["📚 **Grammar power-ups:**\n- **Noun** = a name (Anurag, Patna, game)\n- **Verb** = the action (play, jump)\n- **Adjective** = describes a noun (fast car)\n- **Tenses** = time travel for verbs: play / played / will play\n- **Active:** \"Ram ate the mango\" · **Passive:** \"The mango was eaten by Ram\""] });
    INTENTS.push({ tag: "skill_quizme", patterns: ["quiz me","ask me a question","trivia","trivia question","quiz time","test my knowledge","gk quiz","ask me a quiz question","quiz question","ask me some trivia"],
        responses: ["__SKILL__"] });

    /* v7: live speed-test skill */
    INTENTS.push({ tag: "bot_speed", patterns: ["how fast are you","are you fast","speed test","how quick are you","how fast do you think","are you instant","response time","are you quick"],
        responses: ["__SKILL__"] });

    /* v6: navigation, online safety, keyboard shortcuts */
    INTENTS.push({ tag: "nav_help", patterns: ["how to go back","where is the back button","how to return to hub","how to open a game","menu kahan hai","how to navigate the site","where is everything","site kaise use karein","how to use this site"],
        responses: ["🧭 **Getting around Arcade Hub:**\n1. The **☰ menu** opens every section — games, chat, study, profile\n2. Inside a game, the **← HUB** button brings you back\n3. Multiplayer and Study live in the menu too\n\nLost? Just tap around — everything is one tap away!"] });
    INTENTS.push({ tag: "internet_safety", patterns: ["how to stay safe online","online safety","internet safety","strong password tips","is it safe to chat online","cyber safety","how to make a strong password","online safety tips"],
        responses: ["🛡️ **Online safety rules:**\n- **Never share** your password — not even with friends (or me!)\n- Strong passwords: long + mixed — letters, numbers, symbols\n- Stranger danger applies online too — if something feels wrong, tell an adult\n- Think before clicking weird links\n\nBe smart, be safe! 💪"] });
    INTENTS.push({ tag: "computer_shortcuts", patterns: ["keyboard shortcuts","shortcut keys","ctrl c meaning","copy paste shortcut","useful shortcuts","computer shortcuts","what does ctrl z do"],
        responses: ["⌨️ **Shortcut superpowers:**\n- **Ctrl+C / Ctrl+V** — copy / paste\n- **Ctrl+Z** — undo (the forgiveness key!)\n- **Ctrl+Shift+R** — hard refresh (fixes broken sites!)\n- **Ctrl+F** — find anything on a page\n- **Win+L** — lock your PC instantly"] });

    var BitData = { INTENTS: INTENTS, GAMES: GAMES, QUIZ: QUIZ };
    if (typeof module !== 'undefined' && module.exports) module.exports = BitData;
    else root.BitData = BitData;
})(typeof window !== 'undefined' ? window : globalThis);
