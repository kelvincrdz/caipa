// Quick test script to verify Spotify integration
// Run with: node test-spotify.js

const SPOTIFY_TOKEN = 'BQDdqajKNvX1EQCXHfFeTQAeIrFCHoJI6kPKdrIPcLOk_GuPnuCFnIxFd9cxZnvGmUUag1GH1BoGi_bJ_C1wsbbUJdFNwokLkZYa9YgtwsfPW50B1-c5_Jz64Z7RjipPyawMxkzJzwjPttsjJue4UApHhQnzzsa_ma4ttHYXzaUuSp6pJ7S8XgO0-3rquY123DfeSjYeTjoBRJRQ-IhTFOLUwMO5x6Vsf3WvE1D0N-GcmpEYlOfZJJBU_0HfBfIM7Jm79tlP41FYTVuaLjl1xMM3SknCki_AbdJWbET0pQ2NqNdH71DuX9Fy3EopeEJAam4okQ';

async function testSpotifySearch() {
  console.log('🎵 Testing Spotify Search...\n');

  try {
    const res = await fetch(`https://api.spotify.com/v1/search?q=samba&type=track&limit=3`, {
      headers: {
        Authorization: `Bearer ${SPOTIFY_TOKEN}`,
      },
    });

    const data = await res.json();

    if (data.error) {
      console.error('❌ Error:', data.error.message);
      return;
    }

    console.log('✅ Search Results:');
    data.tracks.items.forEach((track, i) => {
      console.log(`${i + 1}. ${track.name} - ${track.artists.map(a => a.name).join(', ')}`);
    });

  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

async function testTopTracks() {
  console.log('\n🎵 Testing Top Tracks...\n');

  try {
    const res = await fetch(`https://api.spotify.com/v1/me/top/tracks?limit=5`, {
      headers: {
        Authorization: `Bearer ${SPOTIFY_TOKEN}`,
      },
    });

    const data = await res.json();

    if (data.error) {
      console.error('❌ Error:', data.error.message);
      return;
    }

    console.log('✅ Your Top Tracks:');
    data.items.forEach((track, i) => {
      console.log(`${i + 1}. ${track.name} - ${track.artists.map(a => a.name).join(', ')}`);
    });

  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

// Run tests
(async () => {
  await testSpotifySearch();
  await testTopTracks();
  console.log('\n🎉 Spotify integration test complete!');
})();