/**
 * Turn an Axios error from the Profligate API into a message for the user.
 * Validation failures (422) carry field errors like [{ email: "..." }];
 * show the first of those instead of the generic "data is not valid" message.
 */
export const getApiErrorMessage = (error, fallback) => {
  const data = error?.response?.data;
  const firstFieldError = Array.isArray(data?.errors)
    ? Object.values(data.errors[0] || {})[0]
    : null;

  return firstFieldError || data?.message || fallback;
};
