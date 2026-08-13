// The single error shape every route replies with: { error: "..." }.
export const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
