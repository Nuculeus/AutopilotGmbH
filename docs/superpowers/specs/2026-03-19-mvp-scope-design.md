# MVP Scope Design: Brand-Locked Weekly Planner (IG + FB)

Date: 2026-03-19
Owner: Codex + user
Status: Draft (approved in chat)

## Summary
Build an MVP that produces a brand-consistent weekly plan for Instagram and Facebook with 5 cross-posted items per week. The system uses a guided questionnaire, the company website, and social post URLs to build a Brand Voice Profile. Users approve this profile once, then receive a weekly plan with full post packages (DE + EN captions, hashtags, CTA, and a final AI image) inside an in-app calendar. Users can approve or regenerate items and do light edits. Publishing is manual in the MVP.

## Goals
- Generate a complete weekly plan in 10 minutes or less.
- Ensure strong brand and voice consistency (no generic AI output).
- Provide 5 cross-posted items per week for IG + FB.
- Support German and English output for each post.
- Deliver a simple review and approval flow in a calendar view.

## Non-Goals (Out of Scope)
- Direct posting via platform APIs.
- Paid ads or campaign management.
- Multi-account or team collaboration.
- Competitive analysis or attribution models.
- Full image editor or advanced template system.

## User Decisions Captured
- Platforms: Instagram + Facebook (cross-post).
- Weekly volume: 5 posts total (not per platform).
- Inputs: guided questionnaire + website + social post URLs.
- Output detail: full post packages including AI images.
- Editing: light edits (text edit, image regenerate/variation).
- Delivery: in-app calendar review; manual publishing.
- Posting times: suggested slots with optional user-fixed slots.
- Brand Voice Profile: created and approved before first plan.

## Primary User Flow
1. User completes guided questionnaire.
2. User provides website URL and social post URLs.
3. System generates Brand Voice Profile (tone, style, do/dont list, key phrases).
4. User reviews and approves Brand Voice Profile.
5. System generates a weekly plan (5 items) with suggested time slots.
6. System generates each post package:
   - DE caption
   - EN caption
   - Hashtags
   - CTA
   - Final AI image aligned to brand style
7. Quality Gate checks brand alignment and repetition.
8. Calendar review: user approves or regenerates items; light edits allowed.
9. User publishes manually.

## Components
- Brand Intake: questionnaire + website scrape + social URL extractor.
- Brand Profile Generator: builds Brand Voice Profile and visual style cues.
- Post Source Pool: structured inputs from website and social content.
- Weekly Planner: topic mix and 5 weekly items + time slot suggestions.
- Content Generator: DE/EN captions, hashtags, CTA, AI image.
- Quality Gate: brand alignment and uniqueness checks.
- Calendar Review: approve, regenerate, light edits.

## Data Outputs (MVP)
- BrandVoiceProfile
  - tone_summary
  - do_list
  - dont_list
  - key_phrases
  - sample_phrases
  - visual_style_notes
- WeeklyPlan
  - week_start
  - posts[5]
- PostPackage
  - caption_de
  - caption_en
  - hashtags
  - cta
  - image_url
  - suggested_time
  - status (draft, approved)

## Quality Gate Rules (Anti-Slop)
- Enforce Brand Voice Profile constraints (do/dont list, tone summary).
- Reject generic ad-like phrases and fillers.
- Detect near-duplicates across the 5 weekly items.
- Require a minimal uniqueness score per post.
- Provide a short failure reason and a one-click regenerate.

## Error Handling
- Website not readable: fallback to questionnaire only.
- Social URLs invalid or private: show warning and continue with other inputs.
- AI image generation failure: auto-retry, then placeholder with regenerate option.
- Brand Voice mismatch: block and regenerate with targeted constraints.

## Success Criteria
- 80% of users accept the Brand Voice Profile on first review.
- 70% of weekly plans accepted with 1 or fewer regenerations.
- Time to weekly plan: 10 minutes or less.
- User feedback: "feels like our brand".

## Testing (MVP)
- Brand Voice test: 5 sample outputs reviewed for brand fit.
- Duplication test: no two posts with same message/CTA.
- Language test: DE and EN output without literal translation artifacts.
- Image test: AI images match brand cues, no stock-like generic feel.
- Calendar flow: generate -> review -> approve -> regenerate.

## Open Questions
- None for MVP scope. Any future changes require a new spec update.
