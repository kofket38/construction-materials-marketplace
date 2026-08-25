import { useEffect, useReducer } from "react";
import { apiClient } from "@/shared/api/http-client";

type ProofState =
  | { status: "idle" }
  | { status: "loading"; fetchId: number }
  | { status: "success"; fetchId: number; objectUrl: string }
  | { status: "error"; fetchId: number };

type ProofAction =
  | { type: "FETCH_START"; fetchId: number }
  | { type: "FETCH_SUCCESS"; fetchId: number; objectUrl: string }
  | { type: "FETCH_ERROR"; fetchId: number }
  | { type: "RESET" };

function reducer(state: ProofState, action: ProofAction): ProofState {
  switch (action.type) {
    case "RESET":
      return { status: "idle" };
    case "FETCH_START":
      return { status: "loading", fetchId: action.fetchId };
    case "FETCH_SUCCESS":
      if (state.status !== "loading" || state.fetchId !== action.fetchId) {
        return state;
      }
      return { status: "success", fetchId: action.fetchId, objectUrl: action.objectUrl };
    case "FETCH_ERROR":
      if (state.status !== "loading" || state.fetchId !== action.fetchId) {
        return state;
      }
      return { status: "error", fetchId: action.fetchId };
    default:
      return state;
  }
}

let nextFetchId = 0;

/**
 * Fetches a payment proof image through the authenticated API client and returns
 * a blob object URL. The object URL is revoked automatically on unmount or when
 * the filename changes.
 *
 * Returns `null` while loading or if no filename is provided.
 */
export function useProofObjectUrl(
  filename: string | null | undefined,
): { objectUrl: string | null; isLoading: boolean; isError: boolean } {
  const [state, dispatch] = useReducer(reducer, { status: "idle" });

  useEffect(() => {
    if (!filename) {
      dispatch({ type: "RESET" });
      return;
    }

    const fetchId = ++nextFetchId;
    let blobUrl: string | null = null;

    dispatch({ type: "FETCH_START", fetchId });

    apiClient
      .get<Blob>(`/payments/proof/${encodeURIComponent(filename)}`, {
        responseType: "blob",
      })
      .then((response) => {
        blobUrl = URL.createObjectURL(response.data);
        dispatch({ type: "FETCH_SUCCESS", fetchId, objectUrl: blobUrl });
      })
      .catch(() => {
        dispatch({ type: "FETCH_ERROR", fetchId });
      });

    return () => {
      // Invalidate the in-flight fetch by bumping fetchId; revoke any created URL
      nextFetchId++;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        blobUrl = null;
      }
    };
  }, [filename]);

  if (!filename) {
    return { objectUrl: null, isLoading: false, isError: false };
  }

  return {
    objectUrl: state.status === "success" ? state.objectUrl : null,
    isLoading: state.status === "idle" || state.status === "loading",
    isError: state.status === "error",
  };
}
