// Statuses that represent a real decision on the lead — once set on one of
// two linked phone numbers (same lead, imported with 2 phones), it should
// also apply to the other number so we don't keep dialing someone already
// scheduled, interested, disqualified, or waiting on a callback.
const QUALIFYING_STATUSES = ['scheduled', 'interested', 'not_interested', 'callback'];

export async function propagateLinkedStatus(supabase, contactId, updates) {
  if (!QUALIFYING_STATUSES.includes(updates.status)) return;

  const { data: contact } = await supabase
    .from('contacts').select('group_id').eq('id', contactId).single();
  if (!contact?.group_id) return;

  const propagated = {
    status: updates.status,
    ...(updates.callback_at !== undefined  ? { callback_at: updates.callback_at }   : {}),
    ...(updates.scheduled_at !== undefined ? { scheduled_at: updates.scheduled_at } : {}),
  };

  await supabase
    .from('contacts')
    .update(propagated)
    .eq('group_id', contact.group_id)
    .neq('id', contactId);
}
