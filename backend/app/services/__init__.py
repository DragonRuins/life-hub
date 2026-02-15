"""
Services package for Life Hub.

Contains business logic and service layers that sit between
routes (API endpoints) and models (database). This keeps route
files thin and makes logic reusable across different parts of
the application.

Sub-packages:
    channels/  - Notification channel handlers (Pushover, Discord, etc.)
"""
