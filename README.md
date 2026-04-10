# OSRS Route Hub

Curated library of league task routes for Old School RuneScape, formatted for the [Tasks Tracker](https://github.com/osrs-reldo/tasks-tracker-plugin) RuneLite plugin.

## Using a Route

1. Visit the site and find a route you want
2. Click **Copy JSON** to copy the route to your clipboard
3. In RuneLite, open the Tasks Tracker panel
4. Click **...** on the route selector and choose **Import Route from Clipboard**

You can also download the JSON file directly if you prefer.

## Route Format

All routes use the Tasks Tracker plugin's CustomRoute JSON format. They include:

- **Task items** referencing game tasks by `structId`
- **Custom items** for bank stops, teleports, waypoints, and notes
- **Locations** with OSRS tile coordinates for map integration
- **Sections** to organize routes into logical phases

See the [Route Import Format](https://github.com/osrs-reldo/tasks-tracker-plugin/wiki/How-to-Export-Routes-to-Plugin) wiki page for the full spec.

## Adding a Route

Routes are curated. To submit a route, open an issue with:

- The route JSON file
- Author name / credit
- Brief description of what the route covers
- Which league it's for

## Structure

```
routes/
  manifest.json      # Index of all routes with metadata
  <route-id>.json    # Individual route files
css/
  style.css
js/
  app.js
index.html           # Main page
```
