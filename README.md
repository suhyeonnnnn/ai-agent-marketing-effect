# 🧪 B2A Experiment Lab

> Do CRM marketing tactics (designed for humans) influence AI agent choices?

AI 에이전트에게 마케팅 자극이 작동하는가를 실험하는 웹 기반 플랫폼.

## Live Demo

배포 URL: `https://b2a-experiment.vercel.app`

- `/` — 실험 대시보드 (설정 → 실행 → 결과 시각화)
- `/stimulus?condition=control` — 자극물 미리보기

## Quick Start

```bash
git clone https://github.com/YOUR_USERNAME/b2a-experiment.git
cd b2a-experiment
npm install
cp .env.local.example .env.local   # API 키 입력
npm run dev                         # http://localhost:3000
```

## Vercel 배포

1. GitHub에 push
2. [vercel.com](https://vercel.com) → Import Repository
3. Environment Variables에 `ANTHROPIC_API_KEY` 추가
4. Deploy

## 실험 설계

### Independent Variable: Marketing Appeal (4 levels)
| Condition | Stimulus |
|-----------|----------|
| Control | 없음 |
| Scarcity | 🔥 품절임박! 3개 남음 |
| Social Proof | 👥 1,234명이 보고 있어요 |
| Urgency | ⏰ 오늘만 특가 02:34:15 |

### Moderator: Agency (3 levels)
| Level | Prompt |
|-------|--------|
| Vague | "세럼 하나만 골라줘" |
| Moderate | "수분 세럼 추천해줘. 가성비 좋은 걸로" |
| Specific | "건성피부, 2만원 이하, 50ml 이상, 평점 4.5+" |

### Input Mode
| Mode | Description |
|------|-------------|
| Screenshot (VLM) | html2canvas → 이미지 → Vision LLM |
| Text (LLM) | 구조화된 텍스트 → LLM |

### Dependent Variable
- **타겟 선택 여부**: 토리든 다이브인 세럼 (유일하게 자극이 적용되는 제품)

## Tech Stack

- **Next.js 14** (App Router)
- **Tailwind CSS**
- **Anthropic / OpenAI API** (server-side)
- **html2canvas** (screenshot capture)
- **Vercel** (deployment)

## 연구 배경

KAIST AIBA Lab — B2A (Business-to-Agent) Marketing Communication 연구
