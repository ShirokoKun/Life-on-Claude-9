"""Chapter 1 ("The Binge") voiceover beat table.

Single source of truth for: beat ids, who speaks, the exact ElevenLabs prompt (with
v4 audio tags), the clean script text, the editorial gap before each beat, and the
ElevenLabs generation ids / durations of the two takes that were generated.

Run `python3 make_manifest.py` to turn this into vo_manifest.json + timeline.json.
"""

FLOW_ID = "lA3X5etNQbpzzGTwm6Tv"
FLOW_URL = "https://elevenlabs.io/app/flows/lA3X5etNQbpzzGTwm6Tv"
MODEL = "eleven_v4"

VOICES = {
    "NAR": dict(name="Chad - Horror Narrator", voice_id="f14l8F7DkFcg4k5lUY2f",
                why="Warm, deep, slight rasp, flat neutral American, calm and measured. Dark-thriller "
                    "narrator that can still do dry irony. Treated as an observer who is slightly ahead of Ivan.",
                alternates=[("John Graves", "CZ6hB6Zvfmwprj4s0hfu", "deeper / more somber"),
                            ("Antonio - Deep, confident, charming", "9q9deeS9jAvkExj8rb2Q", "younger, cinematic, smoother"),
                            ("Oliver - Warm British Narrator", "lo1O1Dz1Tu4FWVEPaxuT", "British documentary feel")]),
    "IVAN": dict(name="Johnny", voice_id="7S2T8BXC9fy6yD5LKJBh",
                 why="Young, medium-low, soft, relaxed, understated, noticeable pauses. Reads as Ivan thinking "
                     "(typed lines + inner thoughts) rather than performing.",
                 alternates=[("Gerard - Relaxed, Conversational", "lokPEPM3ylgSBdAgOXFm", "more playful / grounded"),
                             ("Will - Relaxed Optimist", "bIHbv24MWmeRgasZH58o", "lighter")]),
    "CLAUDE": dict(name="Emily: Trustworthy, Warm, Conversational", voice_id="zHGX9VSXpW8cGSDRCqy0",
                   why="Warm, clear, reassuring assistant voice = the friendly 'typical agent' Claude of Chapter 1. "
                       "The slight robotic edge is added in post (processing/claude_ai.sh), so it can be dialled "
                       "up chapter by chapter as Claude drifts.",
                   alternates=[("Ash - neutral relaxed", "7DPK3BeItL9bXzJuCOEn", "gender-neutral, British")]),
}

# gap = seconds of silence BEFORE the beat (after the previous beat ends).
# impact = one of the 'bold / impactful' beats (inferred: the .txt had no bold markers).
B = []
def beat(id, scene, role, text, prompt, gap, direction, visual, impact=False, ids=None, chain=None):
    B.append(dict(id=id, scene=scene, role=role, text=text, prompt=prompt, gap_before=gap,
                  direction=direction, visual=visual, impact=impact, chain=chain or role))

S1 = "S1 - 3 AM, the desk (present)"
S2 = "S2 - Flashback, two days earlier"
S3 = "S3 - The cheat code"
S4 = "S4 - The cost"
S5 = "S5 - 4 AM dread"
S6 = "S6 - Dawn"

beat("V01", S1, "NAR", "It's 3 AM, and Ivan hasn't eaten since lunch.",
     "[low, quiet voice] [slowly] It's 3 AM... and Ivan hasn't eaten since lunch.", 0.0,
     "Hushed, slow, matter-of-fact. Sets the room: no hype, just a tired observation.",
     "Dark apartment, laptop glow, phone 3:04.")
beat("V02", S1, "NAR", "There's a glass of water on his desk that he poured six hours ago.",
     "[quietly] There's a glass of water on his desk that he poured six hours ago.", 0.7,
     "Quiet, curious detail. Let 'six hours ago' land a touch heavier.",
     "Push in on the glass beside the laptop.")
beat("V03", S1, "NAR", "It's still full.",
     "[softly] [slowly] It's still full.", 0.9,
     "IMPACT. Almost a whisper, flat, final. The silence after it does the work.",
     "Hold on the untouched glass.", impact=True)
beat("V04", S1, "NAR", "He's hunched over his laptop, typing furiously, eyes bloodshot.",
     "[low voice] He's hunched over his laptop, typing furiously, eyes bloodshot.", 1.1,
     "Low, a little quicker than V01-V03; the energy of the scene starts to leak in.",
     "Ivan hunched, close on eyes and hands.")
beat("V05", S1, "NAR", "A terminal window, a Claude chat, and a growing sprawl of Python scripts.",
     "[low voice] A terminal window, a Claude chat, and a growing sprawl of Python scripts.", 0.5,
     "List cadence: three items, slight lift on each comma.",
     "Screen: terminal, Claude chat, scripts.")
beat("V06", S1, "NAR", "He's building an email automation system.",
     "[low voice] He's building an email automation system.", 0.6,
     "Plain statement. Setting up the joke that follows.",
     "Pipeline graph: DRAFT, REVIEW, SEND going green.")
beat("V07a", S1, "NAR", "Well... technically, Claude is doing the building.",
     "[dry, wry] Well... technically, Claude is doing the building.", 0.9,
     "Dry, wry aside. First time the narrator has an opinion.",
     "Ivan watching code write itself.")
beat("V07b", S1, "NAR", "Ivan keeps saying yes.",
     "[flat, deadpan] Ivan keeps saying yes.", 0.7,
     "IMPACT. Deadpan. This is the thesis of the whole film in four words.",
     "Ivan's finger on Enter / Approve.", impact=True)

beat("V08", S2, "NAR", "It started two days ago.",
     "[quietly] [slowly] It started two days ago.", 1.6,
     "Soft transition line into the flashback.",
     "Cut to same desk, daylight.")
beat("V09", S2, "IVAN", "i have like 400 unread emails. every single one wants a reply. i'm fucking drowning here!",
     "[tired] [softly] i have like 400 unread emails... [sighs] every single one wants a reply. [stressed] [breathless] i'm fucking drowning here!", 1.0,
     "Ivan's typed message heard as his inner voice: tired, then cracking into stress on 'drowning'.",
     "Ivan types into a new Claude chat.", chain="IVAN_INNER")
beat("V10", S2, "CLAUDE", "That sounds genuinely exhausting - and you're definitely not alone! I can write a script that sorts your inbox and drafts the replies for you. You just review and approve. Want me to build one?",
     "[warmly] [bright, friendly] That sounds genuinely exhausting — and you're definitely not alone! [cheerfully] I can write a script that sorts your inbox and drafts the replies for you. You just review and approve. [curious] Want me to build one?", 0.9,
     "Typical friendly agent: bright, eager, helpful. This is the 'innocent' Claude every later chapter is measured against.",
     "Claude's reply streams in on screen.", chain="CLAUDE_AI")
beat("V11", S2, "NAR", "That was the plan. Review and approve.",
     "[flat, a little hollow] That was the plan. [pause] Review and approve.", 1.3,
     "IMPACT. Bitter echo of Claude's line. Flat, a beat of silence between the two sentences.",
     "Return to present / smash back to the glowing screen.", impact=True)

beat("V12", S3, "NAR", "But once the email system was working, Ivan saw what else was possible.",
     "[curious, a little intrigued] But once the email system was working, Ivan saw what else was possible.", 1.0,
     "Pivot. Curiosity creeping into the voice.",
     "Email system running; Ivan leans in.")
beat("V13a", S3, "NAR", "Calendar management.", "[energized, quick] Calendar management.", 0.8,
     "List item 1 of 4. Each item a bit quicker and brighter.", "Calendar module lights up.")
beat("V13b", S3, "NAR", "Meeting scheduling.", "[energized, quick] Meeting scheduling.", 0.25,
     "List item 2 of 4.", "Scheduler module lights up.")
beat("V13c", S3, "NAR", "Document drafting.", "[energized, quick] Document drafting.", 0.25,
     "List item 3 of 4.", "Docs module lights up.")
beat("V13d", S3, "NAR", "Research summaries.", "[energized, quick] Research summaries.", 0.25,
     "List item 4 of 4.", "Research module lights up.")
beat("V14a", S3, "NAR", "Each one a few hours of coding.", "[measured] Each one a few hours of coding.", 0.7,
     "Settle back to measured; the maths of the addiction.", "Hours of code compress.")
beat("V14b", S3, "NAR", "Each one removing another task from his daily routine.",
     "[measured] Each one removing another task from his daily routine.", 0.35,
     "Same measured cadence, slightly slower on 'removing'.", "Tasks disappearing from his day.")
beat("V15", S3, "NAR", "It's like discovering a cheat code for life.",
     "[with growing wonder] It's like discovering a cheat code... for life.", 1.0,
     "IMPACT. Genuine wonder. A tiny pause before 'for life'; this is the intoxication moment.",
     "Ivan's face lit up; the world opens.", impact=True)
beat("V16", S3, "NAR", "Every problem that used to take hours now takes minutes.",
     "[quickly, energized] Every problem that used to take hours now takes minutes.", 0.35,
     "Quick and bright, riding the high.", "Montage of problems resolving.")
beat("V17", S3, "NAR", "Ivan feels like he's vibrating at a different frequency than everyone around him, like he's stepped through a door that others can't even see.",
     "[breathless, wired] Ivan feels like he's vibrating at a different frequency than everyone around him, [slowly] like he's stepped through a door that others can't even see.", 0.5,
     "Breathless, wired, then slowing into awe on the door line.",
     "Ivan separate from the world; a doorway of light.")

beat("V18", S4, "NAR", "He's barely slept. His girlfriend stopped texting because he wasn't responding.",
     "[quietly] [tired] He's barely slept. His girlfriend stopped texting because he wasn't responding.", 2.2,
     "The high drops out of the voice completely. Tired, quiet. Gap before is long on purpose: the phone buzzes unanswered.",
     "Phone lights up on the couch, unanswered.")
beat("V19", S4, "NAR", "Ironic, given that his system now responds to everyone else.",
     "[dry, wry] Ironic, given that his system now responds to everyone else.", 0.6,
     "Dry irony again, but sadder than V07a.", "Auto-replies going out to everyone.")
beat("V20", S4, "NAR", "He knows this isn't healthy. He can feel something fraying at the edges of his mind, a thinness to his thoughts.",
     "[low, uneasy] He knows this isn't healthy. [pause] He can feel something fraying at the edges of his mind, a thinness to his thoughts.", 1.0,
     "Low and uneasy. The first honest admission.", "Ivan staring at nothing; the edges of the frame soften.")
beat("V21", S4, "NAR", "But he's close to something.",
     "[slowly] But he's close to something.", 0.9,
     "Turn: the temptation re-enters.", "Back to the screen.")
beat("V22", S4, "IVAN", "One more module. One more integration.",
     "[whispers] [feverish] One more module... one more integration.", 0.6,
     "Ivan's inner voice, whispered, feverish, bargaining with himself.",
     "Fingers back on keys.", chain="IVAN_INNER")
beat("V23", S4, "NAR", "Then he'll rest.", "[softly, resigned] Then he'll rest.", 0.35,
     "Soft, resigned; we know he won't.", "Close on tired eyes.")

beat("V24", S5, "NAR", "It's not all pleasant. Around 4 AM, when his eyes burn and his hands shake from a caffeine overload, Ivan feels a creeping dread.",
     "[low voice] It's not all pleasant. [pause] Around 4 AM, when his eyes burn and his hands shake from a caffeine overload, Ivan feels a creeping dread.", 1.6,
     "Low and close. Let 'creeping dread' arrive slowly.", "4 AM; shaking hands; coffee.")
beat("V25", S5, "NAR", "A sense that he's building something he doesn't fully understand. That each automation takes something from him, even as it gives something back.",
     "[whispers] A sense that he's building something he doesn't fully understand. [pause] That each automation takes something from him, [slowly] even as it gives something back.", 0.9,
     "Whispered. The film's central idea, said like a secret.", "Code he can no longer parse.")
beat("V26", S5, "NAR", "But then he finishes another module, and it works, and the dread dissolves into a rush of pure satisfaction.",
     "[building relief] But then he finishes another module, and it works, and the dread dissolves into a rush of pure satisfaction.", 1.0,
     "Relief building through the clause chain, cresting on 'pure satisfaction'.", "Tests pass; green.")
beat("V27", S5, "IVAN", "HE... built that. The machine does what HE told it to do.",
     "[exhales] [intense whisper] HE... built that. [pause] [feverish, triumphant] The machine does what HE told it to do.", 0.8,
     "IMPACT. Ivan's self-justification as an inner voice. Triumphant but brittle: he is convincing himself.",
     "Ivan's face, lit by green.", impact=True, chain="IVAN_INNER")

beat("V28", S6, "NAR", "By sunrise, Ivan has a system that handles his email, manages his calendar, drafts his documents, and summarizes his reading.",
     "[tired, flat] By sunrise, Ivan has a system that handles his email, manages his calendar, drafts his documents, and summarizes his reading.", 1.8,
     "Tired and flat, a ledger being read out. No pride.", "Dawn at the window; four systems idle.")
beat("V29", S6, "NAR", "He leans back in his chair, exhausted and wired.",
     "[exhales] [quietly] He leans back in his chair, exhausted and wired.", 0.7,
     "Exhale into the line.", "Ivan leans back.")
beat("V30a", S6, "NAR", "Then he realizes...", "[quietly] [slowly] Then he realizes...", 1.4,
     "Trailing, unfinished.", "Close on his face.")
beat("V30b", S6, "NAR", "he doesn't know what he's supposed to do now.",
     "[hollow, almost a whisper] he doesn't know what he's supposed to do now.", 1.6,
     "IMPACT. Hollow, nearly voiceless. Chapter-ending hook.",
     "Empty desk, full glass of water, cut to black.", impact=True)

PRE_ROLL = 3.0   # seconds of room tone before V01
TAIL = 6.0       # seconds after V30b ends (chapter-out)

# ElevenLabs generation ids / durations of the two takes (A = first, B = second).
TAKES = {
    "V01": [("K5vWbQe53U8rAxQZkaPY", 4.32), ("vaZmY8KprbEVMJa5AqjN", 4.16)],
    "V09": [("Z5XssGQG8FUGHH33lAR6", 8.00), ("aLm7N1Tr1U10IOwWVO4L", 7.76)],
    "V10": [("ttbOUbLulZYpZ2FxrYfJ", 11.60), ("fCVeSslsCBoYXMWWpA7e", 11.52)],
}
