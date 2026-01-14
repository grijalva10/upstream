SELECT name, schedule, timezone, stop_on_reply FROM sequences WHERE id = '831dbe53-4465-4259-a571-9912ccfa6bcd';
SELECT step_number, delay_seconds, delay_seconds/86400 as delay_days FROM sequence_steps WHERE sequence_id = '831dbe53-4465-4259-a571-9912ccfa6bcd' ORDER BY step_number;
