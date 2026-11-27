// Run: npx tsx src/lib/reminders.check.ts
import assert from 'node:assert/strict';
import type { AppData } from './types';
import { dueReminders, fitsLeft, reminderFor } from './reminders';
import type { Food } from './food-match';

// Schedule (Asia/Kolkata local times). Cron runs at :00 and :30.
assert.deepEqual(dueReminders('09:00', 3), ['tasks']);
assert.deepEqual(dueReminders('10:00', 3), ['breakfast']);
assert.deepEqual(dueReminders('10:20', 3), ['breakfast'], 'a late run still sends');
assert.deepEqual(dueReminders('10:30', 3), [], 'the next run does not repeat it');
assert.deepEqual(dueReminders('11:30', 3), ['morningSnack']);
assert.deepEqual(dueReminders('13:00', 3), ['lunch']);
assert.deepEqual(dueReminders('19:00', 3), ['eveningSnack']);
assert.deepEqual(dueReminders('20:30', 3), ['close']);
assert.deepEqual(dueReminders('22:00', 3), ['dinner']);
assert.deepEqual(dueReminders('23:00', 3), ['wrapup']);
assert.deepEqual(dueReminders('11:00', 0), ['checkin'], 'Sunday only');
assert.deepEqual(dueReminders('11:00', 1), []);
assert.deepEqual(dueReminders('03:00', 3), []);

const TODAY = '2026-11-26';
const data = (meals: AppData['fitnessDays'], goals = true): AppData => ({
  tasks: [], noteBoards: [], links: [], journalEntries: [], fitnessDays: meals,
  logTrackers: goals ? [
    { id: 'i', name: 'Daily Calorie Intake', unit: 'kcal', goal: 2000, logs: [] },
    { id: 'p', name: 'Protein Intake', unit: 'g', goal: 150, logs: [] },
  ] : [],
} as unknown as AppData);
const meal = (slot: 'breakfast' | 'lunch' | 'dinner', kcal: number, proteinG: number, name = `${slot} food`) => ({ id: name, name, kcal, proteinG, slot });

// Meal sections: skipped once logged; otherwise says what's left.
const lunchDone = data({ [TODAY]: { meals: [meal('breakfast', 400, 20), meal('lunch', 600, 30)], activities: [] } });
assert.equal(reminderFor('lunch', lunchDone, TODAY, { weighedToday: true }), null);
const dinner = reminderFor('dinner', lunchDone, TODAY, { weighedToday: true })!;
assert.match(dinner.body, /1,000 kcal left/);

// Breakfast also asks for the weigh-in until there is one.
assert.match(reminderFor('breakfast', data({}), TODAY, { weighedToday: false })!.body, /weight/);
assert.equal(reminderFor('breakfast', lunchDone, TODAY, { weighedToday: true }), null);
assert.match(reminderFor('breakfast', lunchDone, TODAY, { weighedToday: false })!.title, /Weigh in/);

// Close the day: what's left, with foods that fit, best protein per kcal first.
const foods: Food[] = [
  { id: 'y', name: 'Greek yogurt', aliases: [], unit: 'g', kcal: 100, proteinG: 10, carbsG: 4, fatG: 4, fiberG: 0, servings: [{ label: 'cup', amount: 150 }] },
  { id: 'w', name: 'Whey protein', aliases: [], unit: 'g', kcal: 400, proteinG: 80, carbsG: 8, fatG: 6, fiberG: 0, servings: [{ label: 'scoop', amount: 32 }] },
  { id: 'c', name: 'Chocolate', aliases: [], unit: 'serving', kcal: 550, proteinG: 5, carbsG: 50, fatG: 35, fiberG: 2, servings: [] },
];
assert.deepEqual(fitsLeft(data({}), TODAY, foods, 500), ['Whey protein (1 scoop)', 'Greek yogurt (1 cup)'], 'chocolate does not fit 500 kcal');
const close = reminderFor('close', lunchDone, TODAY, { weighedToday: true, foods })!;
assert.match(close.title, /100 g protein and 1,000 kcal left/);
assert.match(close.body, /Whey protein \(1 scoop\) or Greek yogurt \(1 cup\) would fit/);
const over = data({ [TODAY]: { meals: [meal('lunch', 2300, 160)], activities: [] } });
assert.match(reminderFor('close', over, TODAY, { weighedToday: true })!.title, /300 kcal over/);
assert.equal(reminderFor('close', data({}), TODAY, { weighedToday: true }), null, 'nothing logged: no close-the-day');
assert.equal(reminderFor('close', data({ [TODAY]: { meals: [meal('lunch', 500, 20)], activities: [] } }, false), TODAY, { weighedToday: true }), null, 'no targets');
// 9 AM plan-your-day: nudges to add tasks, or lists what's planned.
assert.match(reminderFor('tasks', data({}), TODAY, { weighedToday: true, todayTasks: [] })!.body, /No tasks for today yet/);
const planned = reminderFor('tasks', data({}), TODAY, { weighedToday: true, todayTasks: [{ title: 'Gym', done: false }, { title: 'Email', done: true }, { title: 'Read', done: false }] })!;
assert.equal(planned.title, '📝 2 tasks planned today');
assert.match(planned.body, /^Gym, Read\. Anything to add\?$/);
assert.equal(planned.url, '/tasks');
// 11 PM wrap-up: open tasks and unlogged main meals; silent when there's nothing left.
const wrap = reminderFor('wrapup', lunchDone, TODAY, { weighedToday: true, usesLogs: true, todayTasks: [{ title: 'Gym', done: false }, { title: 'Email', done: true }] })!;
assert.match(wrap.body, /1 task still open \(Gym\): tick off what’s done\. No dinner logged yet\./);
assert.equal(wrap.url, '/tasks');
assert.equal(reminderFor('wrapup', lunchDone, TODAY, { weighedToday: true, usesLogs: false, todayTasks: [{ title: 'Email', done: true }] }), null, 'tasks done, not a Logs user: nothing to say');
assert.match(reminderFor('wrapup', lunchDone, TODAY, { weighedToday: true, usesLogs: true, todayTasks: [] })!.url, /\/logs/, 'only food missing → opens Logs');
console.log('reminders: all checks passed');
