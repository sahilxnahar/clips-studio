import type { JSX } from 'react'
import { t } from '../lib/i18n'
import { ratedOutNames } from '../lib/steps'
import type { RunOutcome } from '../lib/types'

/** Why a finished run produced no clips.
 *
 *  This replaces "No clips for this video yet", which reads like a fault and
 *  sends people straight to the bug reporter. The commonest cause by far is
 *  footage the scoring was never meant for — gameplay, or anything with nobody
 *  on screen — and the run knows that: part of a clip's score measures whether
 *  a person is visible, so those score zero on that term rather than merely low.
 *
 *  The tone matters as much as the facts. Someone reading this has just spent
 *  twenty minutes on a video and got nothing back; it has to explain without
 *  reading as "you picked the wrong video".
 */

interface Props {
  outcome: RunOutcome | null | undefined
  compact?: boolean
}

export default function NoClipsExplanation({ outcome, compact }: Props): JSX.Element {
  const size = compact ? 'text-xs' : 'text-sm'

  // Nothing recorded: an older video processed before runs were summarised.
  // Say the plain thing rather than invent a reason.
  if (!outcome || !outcome.candidates) {
    return (
      <p className={`text-muted ${size}`}>
        {t('No clips for this video - or pick another video above.')}
      </p>
    )
  }

  const { candidates, best_score, min_score, cause, measured, nothing_detected } = outcome

  // Moments were chosen and every one failed while being made (core/outcome.py
  // note_render_failures). Something did go wrong, and the minimum score has
  // nothing to do with it (#281: an FFmpeg too new for the app).
  if (cause === 'render_failed') {
    // How many failed (core/outcome.py note_render_failures); `clips` is how
    // many were chosen, the same number when not one could be made.
    const failed = outcome.render_failed ?? outcome.clips
    return (
      <div
        className={`border border-raised/60 rounded-lg p-3 space-y-2 ${size} max-w-2xl`}
        role="note"
      >
        <p className="font-medium text-ink">
          {t('The clips from this video failed while being made.')}
        </p>
        <p className="text-muted">
          {failed === 1
            ? t('1 clip was chosen, but it could not be made.')
            : `${failed} ${t('clips were chosen, but none of them could be made.')}`}
        </p>
        {outcome.render_error && (
          <p className="text-muted">
            {t('What went wrong:')} <span className="text-ink">{outcome.render_error}</span>
          </p>
        )}
        <p className="text-muted">
          {t(
            'Process the video again. If it fails again, send a report from Feedback; the job’s Log in the Queue has the details.'
          )}
        </p>
      </div>
    )
  }

  const numbers =
    best_score === null || best_score === undefined
      ? `${candidates} ${t('moments were considered.')}`
      : `${candidates} ${t('moments were considered; the best scored')} ${best_score} ${t(
          'against a threshold of'
        )} ${min_score}.`

  return (
    <div
      className={`border border-raised/60 rounded-lg p-3 space-y-2 ${size} max-w-2xl`}
      role="note"
    >
      <p className="font-medium text-ink">{t('No clips from this video, and nothing went wrong.')}</p>
      <p className="text-muted">{numbers}</p>

      {/* Every moment was set aside by a Marketplace plugin's rating
          (core/outcome.py rated_out): only that is said, not the footage. */}
      {cause === 'rated_out' && (
        <p className="text-muted">
          {ratedOutNames(outcome).join(', ')} {t('rated every moment under your minimum score')} ({min_score}).{' '}
          {t('Lower the minimum score, or turn off Rate & understand for this video.')}
        </p>
      )}

      {cause === 'no_people' && (
        <>
          <p className="text-muted">
            {t('Nothing person-shaped was detected in')} {nothing_detected} {t('of')} {measured}{' '}
            {t(
              'of the moments it looked at. Part of a clip’s score is whether someone is on screen, so gameplay and top-down footage score zero there rather than just low - which puts them under the threshold.'
            )}
          </p>
          <p className="text-muted">
            {t(
              'Clips Kitty is tuned for IRL, just chatting, podcasts, vlogs and interviews. It is what it was built and tested on.'
            )}
          </p>
        </>
      )}

      {cause === 'duplicates' && (
        <p className="text-muted">
          {t('Most candidates repeated a moment already covered, so they were dropped.')}
        </p>
      )}

      {cause === 'no_candidates' && (
        <p className="text-muted">
          {t(
            'Nothing was proposed at all, which usually means there was no speech to work from.'
          )}
        </p>
      )}

      {cause !== 'rated_out' && (
        <p className="text-muted">
          {cause === 'no_people'
            ? t(
                'Lowering Minimum score in Settings will start producing clips, but they will be picked without the visual half of the signal - expect them to be arbitrary.'
              )
            : t('Lowering Minimum score in Settings would let more of these through.')}
        </p>
      )}
    </div>
  )
}
