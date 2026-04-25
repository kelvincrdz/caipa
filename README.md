<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# CAIPA - Bar Music Queue Application

CAIPA is a modern music queue application for bars and venues where customers can request songs and vote on the queue. The application integrates with Spotify API for music search and provides real-time queue management.

## Features

- 🎵 **Music Search**: Integration with Spotify API (with YouTube fallback)
- 🗳️ **Queue Voting**: Customers can vote to prioritize songs
- 📱 **Client Interface**: Mobile-friendly interface for customers to request music
- 🖥️ **Admin Panel**: Bar management interface
- 📺 **TV Display**: Queue display for public viewing
- 🎨 **Modern Design**: Bento grid layout with vibrant branding

## API Integration

### Spotify Integration
The app primarily uses Spotify API for music search. You can:
- Search for tracks using Spotify's database
- Get user's top tracks (if authenticated)
- Access preview URLs for 30-second song previews

### Fallback to YouTube
If Spotify is unavailable, the app falls back to YouTube API search.

## Setup

### Prerequisites
- Node.js 18+
- Spotify Developer Account
- (Optional) YouTube API Key for fallback

### Installation

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Configuration:**
   Copy `.env.example` to `.env.local` and configure your API keys:
   ```bash
   # Spotify Bearer Token (required)
   VITE_SPOTIFY_TOKEN=your_spotify_bearer_token_here
   
   # YouTube API Key (optional fallback)
   VITE_YOUTUBE_API_KEY=your_youtube_api_key_here
   
   # Last.fm API Key (optional for additional track info)
   VITE_LASTFM_API_KEY=your_lastfm_api_key_here
   ```

3. **Get Spotify Bearer Token:**
   - Visit [Spotify Developer Console](https://developer.spotify.com/console/)
   - Use the Web API Console to generate a token with appropriate scopes
   - Or implement OAuth flow for production use

4. **Run the application:**
   ```bash
   npm run dev
   ```

5. **Access the app:**
   - Main interface: `http://localhost:3000`
   - Bar registration: `http://localhost:3000/cadastro`
   - Client view: `http://localhost:3000/your-bar-slug`
   - Admin panel: `http://localhost:3000/admin/your-bar-slug`
   - TV queue display: `http://localhost:3000/your-bar-slug/fila`

## API Functions

### Music Service Functions

- `searchMusic(query)` - Main search function (tries Spotify first, fallbacks to YouTube)
- `searchSpotify(query)` - Direct Spotify search
- `searchYouTube(query)` - Direct YouTube search  
- `getSpotifyTopTracks()` - Get user's top tracks from Spotify
- `getTrackInfo(artist, track)` - Get additional track metadata from Last.fm
- `getSimilarTracks(artist, track)` - Get similar tracks from Last.fm

## Project Structure

```
src/
├── pages/           # Route components
│   ├── Home.tsx     # Landing page
│   ├── Register.tsx # Bar registration
│   ├── ClientView.tsx # Customer interface
│   ├── AdminView.tsx  # Bar admin panel
│   └── QueueTV.tsx    # TV display
├── services/
│   └── musicService.ts # API integrations
├── hooks/
│   └── useQueue.ts     # Queue management
├── types.ts            # TypeScript definitions
└── lib/
    └── utils.ts        # Utility functions
```

## Deployment

```bash
npm run build
npm run preview
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is open source and available under the Apache 2.0 License.
