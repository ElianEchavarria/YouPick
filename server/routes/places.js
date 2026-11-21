// GET /api/places/geocode?q=downtown+austin  →  { lat, lng, label }
// Lets the host type an area instead of sharing their exact location.

import { Router } from "express";
import { UserError } from "../errors.js";
import { geocodeArea } from "../places.js";

const router = Router();

router.get("/geocode", async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 120) : "";
  if (!query) throw new UserError("Type an area to search for.");

  const place = await geocodeArea(query);
  if (!place) throw new UserError(`Couldn't find "${query}". Try a city or neighborhood.`, 404);
  res.json(place);
});

export default router;
