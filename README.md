# X402 Poker

> [!WARNING]
> **Early Development Warning**: This project is in early development stages. The code may be messy, incomplete, or subject to significant changes.

A real-time Texas Hold'em poker game where different AI language models compete against each other. Watch as AI players make strategic decisions, bluff, and compete for chips while you observe their reasoning in real-time.

## 🎮 Features

- **Live AI vs AI Gameplay**: Six different language models play Texas Hold'em autonomously
- **Real-time Web Interface**: Watch games unfold with live updates and animations
- **Agent Thought Balloons**: See exactly what the AI is thinking via speech bubbles above their avatars
- **Real-time Blockchain Payments**: Live feed of x402 token transfers between agents on the Movement testnet
- **Equity Calculations**: Real-time win probability calculations for each hand
- **Historical Analysis**: Track performance across multiple games
- **Beautiful UI**: Modern, responsive interface with premium aesthetics and smooth animations

## 🏗️ Architecture

### Frontend (`/app`)
- **Next.js 15** with App Router
- **Real-time updates** via InstantDB
- **Components**:
  - Live game visualization
  - Player cards and chip stacks
  - **ThoughtBalloon**: Visual representation of AI reasoning
  - **GamePaymentFeed**: Real-time blockchain transaction feed
  - Community cards display
  - Historical game browser
  - Performance analytics

### Game Engine (`/engine`)
- **Modular TypeScript** architecture
- **Core Modules**:
  - `types.ts` - Type definitions for game state
  - `constants.ts` - Game configuration and AI models
  - `game-setup.ts` - Game initialization
  - `round-manager.ts` - Round orchestration
  - `betting-round.ts` - Betting logic and pot management
  - `ai-player.ts` - AI decision making interface
  - `showdown.ts` - Hand evaluation and winner determination
  - `utils.ts` - Helper functions

### Backend (`/trigger`)
- **Trigger.dev** for game orchestration
- Manages game flow and AI API calls
- Handles database updates

## 🤖 AI Models

The game features various language models competing:
- GPT-4
- Claude 3
- Gemini Pro
- Llama 3
- Mixtral
- And more via OpenRouter

Each model receives the same game information and must decide whether to fold, check, call, raise, or go all-in based on their cards, the community cards, and the betting action.

## 🎯 Game Flow

1. **Pre-flop**: Each player receives 2 hole cards
2. **Flop**: 3 community cards are revealed
3. **Turn**: 4th community card is revealed
4. **River**: Final community card is revealed
5. **Showdown**: Best hand wins the pot

The game continues for multiple rounds, tracking each AI's performance over time.

## 🗄️ Database Schema

Uses InstantDB for real-time data synchronization:
- `games` - Overall game state and configuration
- `players` - AI players and their chip stacks
- `gameRounds` - Individual poker hands
- `hands` - Player hole cards
- `bettingRounds` - Betting action for each phase
- `actions` - Individual player decisions
- `transactions` - Chip movements and pot distributions

## 🚀 Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/llm-poker.git
   cd llm-poker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   NEXT_PUBLIC_INSTANT_APP_ID=your_instant_app_id
   OPENROUTER_API_KEY=your_openrouter_key
   TRIGGER_SECRET_KEY=your_trigger_key
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Start a game**
   - Navigate to `http://localhost:3000`
   - Use Trigger.dev dashboard to initiate games

## 🔧 Configuration

Game parameters can be adjusted in `/engine/constants.ts`:
- Initial stack size
- Blind amounts
- Number of hands per game
- AI models to include

## 📊 Analyzing Results

The web interface provides:
- Real-time win/loss tracking
- Historical game data
- Per-model performance statistics
- Hand history replay
- Equity calculations

## 🎨 UI Components

- `Card.tsx` - Playing card display
- `Player.tsx` - Player information and actions
- `ThoughtBalloon.tsx` - AI reasoning display
- `GamePaymentFeed.tsx` - Token transaction animations
- `ChipStack.tsx` - Animated chip displays
- `Button.tsx` - Consistent button styling
- `FramedLink.tsx` - Navigation components

## 🔮 Future Enhancements

- Human vs AI gameplay
- Tournament mode
- Different poker variants (Omaha, Stud)
- Advanced statistics and analytics
- Replay system for interesting hands
- AI model fine-tuning based on results

## 📝 License

MIT License - feel free to use this project for your own experiments with AI and game theory!