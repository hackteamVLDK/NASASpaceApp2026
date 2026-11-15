// The Emergency chip names the meter's real value: "at 0" only while it is 0 (it stays open until the meter is back at 20).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign } from '../src/campaign/engine.js';
import { hazards, emergencyText } from '../src/campaign/hazards.js';
import { EMERGENCY_CLEAR_AT } from '../src/campaign/data.js';

test('an open Emergency names the real value of its meter', () => {
  const s = createCampaign({ seed: 1 });
  s.emergency.oxygen = true;
  s.res.oxygen = 0;
  assert.match(hazards(s).find((h) => h.id === 'emergency-oxygen').detail, /Oxygen is at 0/);
  s.res.oxygen = 12.6;
  const chip = hazards(s).find((h) => h.id === 'emergency-oxygen');
  assert.equal(chip.title, 'Oxygen emergency');
  assert.doesNotMatch(chip.detail, /at 0/);
  assert.match(chip.detail, new RegExp(`Oxygen is at 12\\. .*${EMERGENCY_CLEAR_AT}`));
  s.res.power = 8;
  assert.match(emergencyText(s, 'power')[1], /^Power is at 8\./);
  assert.match(emergencyText(s, 'heat')[0], /Heat|No heat/);
});
