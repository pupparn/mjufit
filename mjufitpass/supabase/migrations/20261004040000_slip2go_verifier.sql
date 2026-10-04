-- Switch the real slip verifier from SlipOK to Slip2Go. 'slipok' stays
-- allowed so any rows recorded before the switch remain valid.
alter table public.slip_submissions drop constraint slip_submissions_verifier_check;
alter table public.slip_submissions
  add constraint slip_submissions_verifier_check check (verifier in ('slip2go', 'slipok', 'mock'));
