import { defineConfig } from "astro/config";

import sitemap from "@astrojs/sitemap";

export default defineConfig({

site: "https://thetechnologyjoint.com",

integrations: [sitemap()]

});