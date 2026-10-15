"""Chapter 1 cue list. Every cue is ANCHORED to a VO beat id (see 04_TIMELINE/timeline.json), so the whole
score re-times itself when the real clip durations differ from the planned ones.

Anchor = (beat_id, mode, seconds)   mode: 's' = beat start + sec, 'e' = beat end + sec, 'f' = beat start + frac*duration
         ('abs', 'a', seconds)       absolute time from t=0 of the chapter audio
Buses: amb, music, ui, foley, hits.   duck = dB the cue is pulled down while someone is speaking.
auto  = optional gain automation [(anchor, dB), ...] added on top of gain (linear in dB between points)."""

BUS_DUCK = dict(amb=7.0, music=9.0, ui=3.0, foley=4.0, hits=0.0)
CUES = []

def A(t): return ("abs", "a", t)
def bed(id, stem, bus, start, end, gain=0.0, fi=1.0, fo=1.5, loop=True, duck=None, auto=None, note="", pan=0.0):
    CUES.append(dict(kind="bed", id=id, stem=stem, bus=bus, start=start, end=end, gain=gain, fi=fi, fo=fo, loop=loop,
                     duck=BUS_DUCK[bus] if duck is None else duck, auto=auto or [], note=note, pan=pan))
def shot(id, stem, bus, at, gain=0.0, pan=0.0, duck=None, note="", fo=0.0):
    CUES.append(dict(kind="shot", id=id, stem=stem, bus=bus, start=at, end=None, gain=gain, fi=0.0, fo=fo, loop=False,
                     duck=BUS_DUCK[bus] if duck is None else duck, auto=[], note=note, pan=pan))

# ------------------------------------------------------------------ S1  3 AM, the desk
bed("S1_room", "amb_room_tone_3am", "amb", A(0), ("V07b", "e", 1.2), -3, 2.0, 1.2, note="oppressive room tone, starts the chapter")
bed("S1_city", "amb_city_night_far", "amb", A(0), ("V04", "s", 1.0), -9, 0.5, 4.0, note="the world outside, receding as we push in on Ivan")
bed("S1_fan", "amb_laptop_fan", "amb", ("V01", "s", 1.0), ("V07b", "e", 1.0), -12, 2.0, 1.5, note="laptop working hard")
bed("S1_fridge", "amb_fridge_cycle", "amb", A(0), ("V07b", "e", 0.8), -13, 1.0, 1.5, note="compressor cycle; its silence lands under 'still full'")
bed("S1_clock", "fol_wall_clock_tick", "amb", ("V04", "s", 0.0), ("V07b", "e", 0.8), -8, 1.5, 1.2, note="wall clock (seen in the reference clip)")
bed("S1_drone", "mus_drone_isolation", "music", ("V01", "s", 0.6), ("V07b", "e", 0.8), -12, 3.0, 2.5, loop=True, note="isolation drone")
shot("S1_phone_wake", "ui_screen_wake_click", "ui", ("V01", "s", 1.15), -6, 0.5, note="phone screen wakes: 3:04")
shot("V02_glass", "sfx_glass_stillness", "hits", ("V02", "f", 0.45), -9, note="the untouched glass; swells through V03")
shot("V03_drop", "imp_sub_drop_soft", "hits", ("V03", "s", -0.05), -5, note="BOLD  'It's still full.'")
shot("V04_creak", "fol_chair_creak_lean", "foley", ("V04", "s", 0.25), -10, -0.2)
shot("V04_type", "fol_typing_burst_fast", "foley", ("V04", "s", 0.6), -11, note="typing furiously")
shot("V05_type", "fol_typing_burst_slow", "foley", ("V05", "s", 0.0), -13, 0.2)
shot("V05_stream", "ui_terminal_text_stream_long", "ui", ("V05", "s", 0.8), -12, -0.25, note="terminal scrolling")
shot("V05_chat", "ui_msg_receive_tick", "ui", ("V05", "f", 0.55), -11, 0.3, note="Claude chat")
shot("V05_enter", "fol_key_enter", "foley", ("V05", "f", 0.8), -10)
shot("V06_ping_a", "ui_module_ping_a", "ui", ("V06", "f", 0.33), -10, -0.4, note="DRAFT green")
shot("V06_ping_b", "ui_module_ping_b", "ui", ("V06", "f", 0.58), -10, 0.0, note="REVIEW green")
shot("V06_ping_c", "ui_module_ping_c", "ui", ("V06", "f", 0.83), -10, 0.4, note="SEND green")
shot("V06_send", "ui_pipeline_send_confirm", "ui", ("V06", "e", -0.8), -8, note="pipeline complete")
shot("V07a_chime", "ui_claude_chime_friendly", "ui", ("V07a", "f", 0.5), -11, 0.3, note="Claude's motif: 'Claude is doing the building'")
shot("V07a_stream", "ui_terminal_text_stream_short", "ui", ("V07a", "s", 1.9), -12, -0.2, note="code writing itself")
shot("V07b_enter1", "fol_key_enter", "foley", ("V07b", "s", 0.55), -8)
shot("V07b_enter2", "fol_key_enter", "foley", ("V07b", "s", 1.15), -8)
shot("V07b_enter3", "fol_key_enter", "foley", ("V07b", "s", 1.7), -8)
shot("V07b_hit", "imp_tonal_hit_minor2", "hits", ("V07b", "s", 1.1), -8, note="BOLD  'Ivan keeps saying yes.'")

# ------------------------------------------------------------------ S2  Flashback
shot("T_flashback", "trn_flashback_timeshift", "hits", ("V07b", "e", -0.6), -9, note="present -> two days ago")
bed("S2_daylight", "amb_daylight_room", "amb", ("V08", "s", -0.5), ("V11", "s", 0.1), -3, 1.0, 0.25, note="flashback room tone (daylight)")
shot("V09_type", "fol_typing_burst_slow", "foley", ("V09", "s", 0.3), -13, 0.2, note="Ivan typing into a new chat")
shot("V09_send", "ui_msg_send_tick", "ui", ("V09", "e", 0.25), -9, 0.2)
shot("V10_indicator", "ui_typing_indicator", "ui", ("V10", "s", -0.6), -10, -0.2)
shot("V10_chime", "ui_claude_chime_friendly", "ui", ("V10", "s", -0.15), -6, note="Claude's first entrance. Friendly, human-feeling")
bed("S2_wonder", "mus_wonder_pad", "music", ("V10", "s", -0.5), ("V10", "e", 1.2), -10, 2.0, 2.5, loop=False, note="'it's working' glow under Claude's reply")
shot("V10_stream_a", "ui_terminal_text_stream_long", "ui", ("V10", "s", 0.6), -16, -0.3, note="reply streaming in")
shot("V10_stream_b", "ui_terminal_text_stream_long", "ui", ("V10", "s", 5.6), -17, 0.3)
shot("V10_stream_c", "ui_terminal_text_stream_short", "ui", ("V10", "s", 10.2), -16, 0.0)

# ------------------------------------------------------------------ S3  The cheat code
shot("V11_wake", "ui_screen_wake_click", "ui", ("V11", "s", -0.1), -7)
shot("V11_drop", "imp_sub_drop_soft", "hits", ("V11", "s", 0.0), -7, note="BOLD  'That was the plan. Review and approve.'  Smash back to the present")
bed("S3_room", "amb_room_tone_3am", "amb", ("V11", "s", -0.2), ("V27", "e", 0.0), -3, 0.3, 0.5, auto=[(("V17", "e", -0.3), 0), (("V17", "e", 0.3), -7), (("V18", "e", 0.0), -7), (("V19", "s", 0.0), -2), (("V19", "e", 0.0), 0)],
    note="present-day room tone for the rest of the night; dips to near-silence at the vacuum cut (V17->V18)")
bed("S3_fan", "amb_laptop_fan", "amb", ("V11", "s", 0.0), ("V27", "e", 0.0), -12, 0.5, 0.5, auto=[(("V17", "e", -0.3), 0), (("V17", "e", 0.3), -9), (("V18", "e", 0.0), -9), (("V19", "s", 0.0), -3), (("V19", "e", 0.0), 0), (("V24", "s", 0.0), 0), (("V24", "e", 0.0), 3)])
bed("S3_ramp", "mus_pulse_ramp", "music", ("V12", "e", -2.5), ("V12", "e", 13.7), -9, 0.8, 2.0, loop=False, note="nervous system warming up; peaks at the list items")
bed("S3_hold", "mus_pulse_hold", "music", ("V14a", "s", 0.0), ("V17", "e", -0.05), -10, 3.0, 0.3, loop=True, note="132 bpm pulse = vibrating. Cut dead at the vacuum")
shot("V12_ok", "ui_compile_success", "ui", ("V12", "f", 0.3), -8, note="email system working")
shot("V13a_ping", "ui_module_ping_a", "ui", ("V13a", "s", 0.05), -7, -0.4, note="Calendar management lights up")
shot("V13b_ping", "ui_module_ping_b", "ui", ("V13b", "s", 0.05), -7, -0.15, note="Meeting scheduling")
shot("V13c_ping", "ui_module_ping_c", "ui", ("V13c", "s", 0.05), -7, 0.15, note="Document drafting")
shot("V13d_ping", "ui_module_ping_d", "ui", ("V13d", "s", 0.05), -7, 0.4, note="Research summaries")
shot("V14a_type", "fol_typing_burst_fast", "foley", ("V14a", "s", -0.2), -14, note="hours of code...")
shot("V14a_skip", "trn_time_skip_tick", "hits", ("V14a", "s", 0.05), -11, note="...compress")
shot("V14b_pop1", "ui_task_clear_pop", "ui", ("V14b", "f", 0.18), -8, -0.3, note="tasks disappearing from his day")
shot("V14b_pop2", "ui_task_clear_pop", "ui", ("V14b", "f", 0.4), -8, 0.3)
shot("V14b_pop3", "ui_task_clear_pop", "ui", ("V14b", "f", 0.62), -8, -0.1)
shot("V14b_takegive", "sfx_take_give", "hits", ("V14b", "f", 0.55), -11, note="takes something from him even as it gives")
shot("V15_rush", "ui_module_complete_rush", "ui", ("V15", "s", 0.35), -4, note="BOLD  'a cheat code for life': the rush")
shot("V16_pop1", "ui_task_clear_pop", "ui", ("V16", "f", 0.3), -9, -0.3)
shot("V16_pop2", "ui_task_clear_pop", "ui", ("V16", "f", 0.55), -9, 0.3)
shot("V16_ok", "ui_compile_success", "ui", ("V16", "e", -0.9), -9, note="problems resolving in minutes")
shot("V17_door", "trn_door_threshold", "hits", ("V17", "s", -0.35), -9, note="a doorway only Ivan can see")
shot("V17_vib", "sfx_vibrating_frequency", "hits", ("V17", "s", 0.45), -8, note="'vibrating at a different frequency': swells then cut at the end of the line")

# ------------------------------------------------------------------ S4  The cost
shot("T_vacuum", "trn_vacuum_dropout", "hits", ("V17", "e", -0.2), -6, note="the high is cut off: the world empties")
shot("V18_buzz", "fol_phone_buzz_couch", "foley", ("V17", "e", 0.3), -7, -0.6, note="girlfriend's text, unanswered (lands before V18)")
shot("V19_flurry", "ui_auto_reply_flurry", "ui", ("V19", "f", 0.55), -7, note="'his system now responds to everyone else'")
bed("S4_drone", "mus_drone_isolation", "music", ("V18", "s", -1.0), ("V23", "e", 1.0), -11, 3.0, 3.5, note="isolation returns")
bed("S4_heart", "fol_heartbeat_62bpm_loop", "foley", ("V20", "s", 1.5), ("V23", "e", 0.5), -17, 2.5, 1.5, note="body awareness: 62 bpm")
shot("V20_fray", "sfx_fraying_texture", "hits", ("V20", "s", 1.6), -10, note="'something fraying at the edge'")
shot("V21_wake", "ui_screen_wake_click", "ui", ("V21", "s", -0.1), -9)
shot("V21_lean", "fol_chair_creak_lean", "foley", ("V21", "s", 0.5), -11, 0.2, note="back to the screen")
shot("V22_type", "fol_typing_burst_fast", "foley", ("V22", "s", -0.3), -12, note="fingers back on keys")
shot("V22_ping1", "ui_module_ping_a", "ui", ("V22", "f", 0.3), -11, -0.3)
shot("V22_ping2", "ui_module_ping_c", "ui", ("V22", "f", 0.78), -11, 0.3)
shot("V23_breath", "fol_breath_exhale", "foley", ("V23", "e", -0.7), -9, note="'Then he'll rest.'")
shot("T_timeskip", "trn_time_skip_tick", "hits", ("V23", "e", 0.35), -10, note="hours pass: 3 AM -> 4 AM")

# ------------------------------------------------------------------ S5  4 AM dread
bed("S5_dread", "mus_dread_cluster", "music", ("V23", "e", 0.4), ("V26", "f", 0.2), -8, 2.5, 1.8, loop=False, note="semitone cluster crawling up; dissolves when the module works")
bed("S5_heart", "fol_heartbeat_ramp", "foley", ("V24", "f", 0.3), ("V25", "e", 0.3), -14, 1.5, 1.5, loop=False, note="62 -> 100 bpm")
bed("S5_clock", "fol_wall_clock_tick", "amb", ("V23", "e", 0.5), ("V27", "s", 0.2), -3, 1.5, 0.3, note="clock louder at 4 AM")
shot("V24_tremor", "sfx_caffeine_tremor", "hits", ("V24", "f", 0.55), -9, note="'his hands shake'")
shot("V25_stream", "ui_terminal_text_stream_long", "ui", ("V25", "s", 0.4), -17, 0.35, note="code he can no longer parse")
shot("V25_fray", "sfx_fraying_texture", "hits", ("V25", "f", 0.62), -12, note="'something he doesn't fully understand'")
shot("V26_ok", "ui_compile_success", "ui", ("V26", "f", 0.2), -6, note="module works: the dread dissolves")
shot("V26_rush", "ui_module_complete_rush", "ui", ("V26", "f", 0.26), -8)
bed("S5_wonder", "mus_wonder_pad", "music", ("V26", "f", 0.16), ("V27", "e", 0.0), -8, 1.5, 0.7, loop=False, note="relief / pride glow, too bright, a little wrong")
shot("V26_send", "ui_pipeline_send_confirm", "ui", ("V26", "f", 0.72), -10, note="tests pass; green")
shot("V27_hit", "imp_tonal_hit_minor2", "hits", ("V27", "s", 0.05), -7, note="BOLD  'HE... built that.'")
shot("V27_drop", "imp_sub_drop_soft", "hits", ("V27", "f", 0.48), -4, note="BOLD  'what HE told it to do.'")

# ------------------------------------------------------------------ S6  Dawn
shot("T_vacuum2", "trn_vacuum_dropout", "hits", ("V27", "e", -0.05), -8, note="pride cut off")
shot("V27_chime", "ui_claude_chime_neutral", "ui", ("V27", "e", 1.05), -11, 0.15, note="Claude's motif, one shade colder")
shot("T_dawn", "trn_dawn_rise", "hits", ("V28", "s", -0.5), -11, note="sunrise")
bed("S6_dawn", "amb_dawn_hollow", "amb", ("V28", "s", -0.6), A(198.0), -5, 3.0, 3.0, note="post-binge hollow: tinnitus-thin tone, exhausted and wired")
bed("S6_music", "mus_hollow_dawn", "music", ("V28", "f", 0.3), A(200.0), -8, 2.0, 6.0, loop=False, note="sparse bells in a big empty room")
shot("V28_ping1", "ui_module_ping_a", "ui", ("V28", "f", 0.3), -15, -0.4, note="four systems idle")
shot("V28_ping2", "ui_module_ping_c", "ui", ("V28", "f", 0.45), -15, 0.4)
shot("V28_ping3", "ui_module_ping_a", "ui", ("V28", "f", 0.6), -16, -0.2)
shot("V28_ping4", "ui_module_ping_c", "ui", ("V28", "f", 0.75), -16, 0.2)
shot("V29_tremor", "sfx_caffeine_tremor", "hits", ("V29", "f", 0.15), -17)
shot("V29_lean", "fol_chair_creak_lean", "foley", ("V29", "s", 0.4), -10, 0.1, note="he leans back")
shot("V29_breath", "fol_breath_exhale", "foley", ("V29", "f", 0.7), -8, note="exhausted")
shot("V30_glass", "sfx_glass_stillness", "hits", ("V30a", "s", -0.2), -7, note="the full glass, again. Swells to the last line")
shot("V30_vac", "trn_vacuum_dropout", "hits", ("V30b", "f", 0.96), -9, note="cut to black")
shot("V30_hook", "ui_claude_chime_hollow", "ui", ("V30b", "e", 0.4), -4, duck=0.0, note="BOLD  chapter-out hook: Claude's motif, hollowed out")
