/** Offline, deterministic planning rules. These are prompts for action, not predictions. */
export type Advice = { recommendation: string; confidence: string; nextActions: string[] };
export function advise(goal: string, evidence: string, assumptions: string): Advice {
  const g = goal.toLowerCase();
  const actions: string[] = [];
  if (/earn|income|client|business|sell|profit|freelanc/.test(g)) {
    actions.push('Calculate the remaining revenue target using verified prices and completed sales.', 'Identify one potential customer and prepare a specific, low-cost offer.', 'Record actual income and expenses before revising the plan.');
  } else if (/learn|study|exam|english|language|course/.test(g)) {
    actions.push('Define one topic and a 20-minute study session.', 'Test recall without looking at the material.', 'Record mistakes and schedule a short review.');
  } else if (/fitness|walk|exercise|training|workout/.test(g)) {
    actions.push('Choose a safe activity appropriate to your current ability.', 'Schedule a manageable session and allow recovery.', 'Log what you completed without treating rest as failure.');
  } else if (/job|interview|career|cv|employment/.test(g)) {
    actions.push('List the specific requirements for one opportunity.', 'Prepare one application or practice one interview question.', 'Track submissions and replies, then adjust based on feedback.');
  } else {
    actions.push('Describe a measurable result and a realistic deadline.', 'Break the goal into one task that takes 15–30 minutes.', 'Review the result and choose the next step.');
  }
  if (!evidence.trim()) actions.unshift('Gather at least one verifiable fact about your starting point.');
  if (!assumptions.trim()) actions.push('Write down the key unknowns before estimating an outcome.');
  return { recommendation: actions.join(' '), confidence: evidence.trim() && assumptions.trim() ? 'Unverified inputs supplied; no numerical confidence estimate.' : 'Insufficient evidence for a reliable forecast.', nextActions: actions };
}
