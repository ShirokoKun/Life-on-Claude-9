# Chapter 1 - Voiceover script, casting and direction

Flow with all 72 takes (36 beats x A/B): https://elevenlabs.io/app/flows/lA3X5etNQbpzzGTwm6Tv  (model `eleven_v4`, audio-tag prompts)

**Bold / impact beats** are marked ★. The source .txt had no bold markers, so these were inferred from the writing (short punch lines, turns, the chapter hook). Tell me if a different line should be the hit.

## Cast

| Role | ElevenLabs voice | Why | Alternates |
|---|---|---|---|
| NAR | Chad - Horror Narrator (`f14l8F7DkFcg4k5lUY2f`) | Warm, deep, slight rasp, flat neutral American, calm and measured. Dark-thriller narrator that can still do dry irony. Treated as an observer who is slightly ahead of Ivan. | John Graves - deeper / more somber; Antonio - Deep, confident, charming - younger, cinematic, smoother; Oliver - Warm British Narrator - British documentary feel |
| IVAN | Johnny (`7S2T8BXC9fy6yD5LKJBh`) | Young, medium-low, soft, relaxed, understated, noticeable pauses. Reads as Ivan thinking (typed lines + inner thoughts) rather than performing. | Gerard - Relaxed, Conversational - more playful / grounded; Will - Relaxed Optimist - lighter |
| CLAUDE | Emily: Trustworthy, Warm, Conversational (`zHGX9VSXpW8cGSDRCqy0`) | Warm, clear, reassuring assistant voice = the friendly 'typical agent' Claude of Chapter 1. The slight robotic edge is added in post (processing/claude_ai.sh), so it can be dialled up chapter by chapter as Claude drifts. | Ash - neutral relaxed - gender-neutral, British |

Voices were chosen from their descriptions; I could not audition audio in my sandbox. Listen to take A and B per beat and swap to an alternate if a voice feels wrong (the beat prompts are voice-independent).


## S1 - 3 AM, the desk (present)

| Beat | Role | Time (planned) | Line | ElevenLabs prompt | Direction |
|---|---|---|---|---|---|
| V01 | NAR | 3.00-7.32 | It's 3 AM, and Ivan hasn't eaten since lunch. | `[low, quiet voice] [slowly] It's 3 AM... and Ivan hasn't eaten since lunch.` | Hushed, slow, matter-of-fact. Sets the room: no hype, just a tired observation. |
| V02 | NAR | 8.02-11.94 | There's a glass of water on his desk that he poured six hours ago. | `[quietly] There's a glass of water on his desk that he poured six hours ago.` | Quiet, curious detail. Let 'six hours ago' land a touch heavier. |
| ★ V03 | NAR | 12.84-14.60 | It's still full. | `[softly] [slowly] It's still full.` | IMPACT. Almost a whisper, flat, final. The silence after it does the work. |
| V04 | NAR | 15.70-20.50 | He's hunched over his laptop, typing furiously, eyes bloodshot. | `[low voice] He's hunched over his laptop, typing furiously, eyes bloodshot.` | Low, a little quicker than V01-V03; the energy of the scene starts to leak in. |
| V05 | NAR | 21.00-26.04 | A terminal window, a Claude chat, and a growing sprawl of Python scripts. | `[low voice] A terminal window, a Claude chat, and a growing sprawl of Python scripts.` | List cadence: three items, slight lift on each comma. |
| V06 | NAR | 26.64-29.44 | He's building an email automation system. | `[low voice] He's building an email automation system.` | Plain statement. Setting up the joke that follows. |
| V07a | NAR | 30.34-34.18 | Well... technically, Claude is doing the building. | `[dry, wry] Well... technically, Claude is doing the building.` | Dry, wry aside. First time the narrator has an opinion. |
| ★ V07b | NAR | 34.88-36.96 | Ivan keeps saying yes. | `[flat, deadpan] Ivan keeps saying yes.` | IMPACT. Deadpan. This is the thesis of the whole film in four words. |

## S2 - Flashback, two days earlier

| Beat | Role | Time (planned) | Line | ElevenLabs prompt | Direction |
|---|---|---|---|---|---|
| V08 | NAR | 38.56-40.88 | It started two days ago. | `[quietly] [slowly] It started two days ago.` | Soft transition line into the flashback. |
| V09 | IVAN | 41.88-49.88 | i have like 400 unread emails. every single one wants a reply. i'm fucking drowning here! | `[tired] [softly] i have like 400 unread emails... [sighs] every single one wants a reply. [stressed] [breathless] i'm fucking drowning here!` | Ivan's typed message heard as his inner voice: tired, then cracking into stress on 'drowning'. |
| V10 | CLAUDE | 50.78-62.38 | That sounds genuinely exhausting - and you're definitely not alone! I can write a script that sorts your inbox and drafts the replies for you. You just review and approve. Want me to build one? | `[warmly] [bright, friendly] That sounds genuinely exhausting — and you're definitely not alone! [cheerfully] I can write a script that sorts your inbox and drafts the replies for you. You just review and approve. [curious] Want me to build one?` | Typical friendly agent: bright, eager, helpful. This is the 'innocent' Claude every later chapter is measured against. |
| ★ V11 | NAR | 63.68-67.28 | That was the plan. Review and approve. | `[flat, a little hollow] That was the plan. [pause] Review and approve.` | IMPACT. Bitter echo of Claude's line. Flat, a beat of silence between the two sentences. |

## S3 - The cheat code

| Beat | Role | Time (planned) | Line | ElevenLabs prompt | Direction |
|---|---|---|---|---|---|
| V12 | NAR | 68.28-73.00 | But once the email system was working, Ivan saw what else was possible. | `[curious, a little intrigued] But once the email system was working, Ivan saw what else was possible.` | Pivot. Curiosity creeping into the voice. |
| V13a | NAR | 73.80-75.24 | Calendar management. | `[energized, quick] Calendar management.` | List item 1 of 4. Each item a bit quicker and brighter. |
| V13b | NAR | 75.49-76.93 | Meeting scheduling. | `[energized, quick] Meeting scheduling.` | List item 2 of 4. |
| V13c | NAR | 77.18-78.86 | Document drafting. | `[energized, quick] Document drafting.` | List item 3 of 4. |
| V13d | NAR | 79.11-80.63 | Research summaries. | `[energized, quick] Research summaries.` | List item 4 of 4. |
| V14a | NAR | 81.33-84.29 | Each one a few hours of coding. | `[measured] Each one a few hours of coding.` | Settle back to measured; the maths of the addiction. |
| V14b | NAR | 84.64-88.48 | Each one removing another task from his daily routine. | `[measured] Each one removing another task from his daily routine.` | Same measured cadence, slightly slower on 'removing'. |
| ★ V15 | NAR | 89.48-92.92 | It's like discovering a cheat code for life. | `[with growing wonder] It's like discovering a cheat code... for life.` | IMPACT. Genuine wonder. A tiny pause before 'for life'; this is the intoxication moment. |
| V16 | NAR | 93.27-96.31 | Every problem that used to take hours now takes minutes. | `[quickly, energized] Every problem that used to take hours now takes minutes.` | Quick and bright, riding the high. |
| V17 | NAR | 96.81-104.49 | Ivan feels like he's vibrating at a different frequency than everyone around him, like he's stepped through a door that others can't even see. | `[breathless, wired] Ivan feels like he's vibrating at a different frequency than everyone around him, [slowly] like he's stepped through a door that others can't even see.` | Breathless, wired, then slowing into awe on the door line. |

## S4 - The cost

| Beat | Role | Time (planned) | Line | ElevenLabs prompt | Direction |
|---|---|---|---|---|---|
| V18 | NAR | 106.69-111.49 | He's barely slept. His girlfriend stopped texting because he wasn't responding. | `[quietly] [tired] He's barely slept. His girlfriend stopped texting because he wasn't responding.` | The high drops out of the voice completely. Tired, quiet. Gap before is long on purpose: the phone buzzes unanswered. |
| V19 | NAR | 112.09-116.01 | Ironic, given that his system now responds to everyone else. | `[dry, wry] Ironic, given that his system now responds to everyone else.` | Dry irony again, but sadder than V07a. |
| V20 | NAR | 117.01-124.69 | He knows this isn't healthy. He can feel something fraying at the edges of his mind, a thinness to his thoughts. | `[low, uneasy] He knows this isn't healthy. [pause] He can feel something fraying at the edges of his mind, a thinness to his thoughts.` | Low and uneasy. The first honest admission. |
| V21 | NAR | 125.59-128.07 | But he's close to something. | `[slowly] But he's close to something.` | Turn: the temptation re-enters. |
| V22 | IVAN | 128.67-132.03 | One more module. One more integration. | `[whispers] [feverish] One more module... one more integration.` | Ivan's inner voice, whispered, feverish, bargaining with himself. |
| V23 | NAR | 132.38-134.46 | Then he'll rest. | `[softly, resigned] Then he'll rest.` | Soft, resigned; we know he won't. |

## S5 - 4 AM dread

| Beat | Role | Time (planned) | Line | ElevenLabs prompt | Direction |
|---|---|---|---|---|---|
| V24 | NAR | 136.06-145.66 | It's not all pleasant. Around 4 AM, when his eyes burn and his hands shake from a caffeine overload, Ivan feels a creeping dread. | `[low voice] It's not all pleasant. [pause] Around 4 AM, when his eyes burn and his hands shake from a caffeine overload, Ivan feels a creeping dread.` | Low and close. Let 'creeping dread' arrive slowly. |
| V25 | NAR | 146.56-156.16 | A sense that he's building something he doesn't fully understand. That each automation takes something from him, even as it gives something back. | `[whispers] A sense that he's building something he doesn't fully understand. [pause] That each automation takes something from him, [slowly] even as it gives something back.` | Whispered. The film's central idea, said like a secret. |
| V26 | NAR | 157.16-163.96 | But then he finishes another module, and it works, and the dread dissolves into a rush of pure satisfaction. | `[building relief] But then he finishes another module, and it works, and the dread dissolves into a rush of pure satisfaction.` | Relief building through the clause chain, cresting on 'pure satisfaction'. |
| ★ V27 | IVAN | 164.76-170.76 | HE... built that. The machine does what HE told it to do. | `[exhales] [intense whisper] HE... built that. [pause] [feverish, triumphant] The machine does what HE told it to do.` | IMPACT. Ivan's self-justification as an inner voice. Triumphant but brittle: he is convincing himself. |

## S6 - Dawn

| Beat | Role | Time (planned) | Line | ElevenLabs prompt | Direction |
|---|---|---|---|---|---|
| V28 | NAR | 172.56-180.80 | By sunrise, Ivan has a system that handles his email, manages his calendar, drafts his documents, and summarizes his reading. | `[tired, flat] By sunrise, Ivan has a system that handles his email, manages his calendar, drafts his documents, and summarizes his reading.` | Tired and flat, a ledger being read out. No pride. |
| V29 | NAR | 181.50-186.38 | He leans back in his chair, exhausted and wired. | `[exhales] [quietly] He leans back in his chair, exhausted and wired.` | Exhale into the line. |
| V30a | NAR | 187.78-189.78 | Then he realizes... | `[quietly] [slowly] Then he realizes...` | Trailing, unfinished. |
| ★ V30b | NAR | 191.38-194.26 | he doesn't know what he's supposed to do now. | `[hollow, almost a whisper] he doesn't know what he's supposed to do now.` | IMPACT. Hollow, nearly voiceless. Chapter-ending hook. |
