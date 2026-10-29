# Ember V1.9.52 UI notes

Ember replies now render as clean, full-width text instead of dark chat bubbles. User messages remain in their existing orange bubbles. The reply action row remains underneath each Ember reply, including read aloud, copy, and the final-message “again” action; no underlying handler was removed.

The plus control remains a fixed 38×38px circular control, centered against the Send button, composer row, and input at the tested 320px, 360px, 390px, 430px, and 760px widths. Its menu and keyboard dismissal behavior remain unchanged.

The UI regression passed at all five widths, and the clean-reply assertion confirms no assistant background, border, left border, or radius while the action row remains below the reply text.
