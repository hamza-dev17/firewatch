"""Shared weather service errors."""


class WeatherServiceError(RuntimeError):
    """Raised when weather data cannot be fetched or normalized."""
