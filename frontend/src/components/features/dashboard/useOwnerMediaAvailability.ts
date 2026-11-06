"use client";

import { useEffect, useState } from "react";
import { getOwnerMediaAvailability } from "@/services/owner-media-service";

export function useOwnerMediaAvailability() {
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void getOwnerMediaAvailability().then((value) => {
      if (active) setAvailable(value);
    }).catch(() => { if (active) setAvailable(false); }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);
  return { available, loading };
}
