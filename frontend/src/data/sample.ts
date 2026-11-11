// Shown only when api.arrazy.com can't be reached (for example when it's down),
// so the page never looks broken.
import type { NowPlaying, Playlist, TopArtist } from "../lib/api";

export const sampleNowPlaying: NowPlaying = {
  playing: true,
  title: "Wish U Well",
  artist: "underscores",
  album_art: null,
  url: null,
};

export const sampleTopArtist: TopArtist = { name: "underscores", image: null, url: null, hours: null };

const t = (title: string, artists = "Artist Name") => ({ title, artists: artists.split(", "), url: null });

export const samplePlaylist: Playlist = {
  artists: [
    {
      name: "Artist Name",
      albums: [
        { title: "First Album", year: "2019", image: null, url: null,
          tracks: [t("Opening Song"), t("Afternoon Rain", "Artist Name, Guest Singer"), t("Going Home"), t("Midnight Drive"), t("Old Town")] },
        { title: "Second Album", year: "2021", image: null, url: null,
          tracks: [t("Morning Walk"), t("Street Lights", "Artist Name, Guest Singer"), t("Better Days"), t("The Sea")] },
        { title: "Third Album", year: "2023", image: null, url: null,
          tracks: [t("Blue Sky"), t("One Day"), t("Stay", "Artist Name, Guest Singer"), t("Slowly")] },
      ],
    },
  ],
};
