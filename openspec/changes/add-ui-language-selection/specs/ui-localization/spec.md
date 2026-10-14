## Purpose

Let users read and operate the dashboard in Spanish or English (US) without changing the language of their locally collected activity data.

## ADDED Requirements

### Requirement: User can choose and retain a dashboard language
The dashboard SHALL offer Spanish and English (US) as language choices. It SHALL use Spanish when no valid choice has been saved and SHALL retain a selected choice across page navigation and browser reloads.

#### Scenario: First visit uses Spanish
- **WHEN** the browser has no saved language preference
- **THEN** the dashboard displays its interface in Spanish

#### Scenario: User selects English
- **WHEN** the user selects English (US)
- **THEN** the dashboard updates its interface immediately and keeps English selected after a reload

#### Scenario: Invalid saved preference
- **WHEN** the browser contains an unsupported language value
- **THEN** the dashboard falls back to Spanish

### Requirement: App-authored interface text follows the selected language
Navigation, page headings, controls, help content, accessible labels, empty/loading/error states, and app-generated recommendations SHALL use the selected language. User or source data, including prompts, paths, model identifiers, and skill names, SHALL remain unchanged.

#### Scenario: English interface
- **WHEN** English (US) is selected
- **THEN** app-authored interface text is shown in English while user and source data remain as collected

#### Scenario: Spanish interface
- **WHEN** Spanish is selected
- **THEN** app-authored interface text is shown in Spanish while user and source data remain as collected

### Requirement: Locale-sensitive values use the selected language
The dashboard SHALL format app-generated dates and numbers using the selected language locale while retaining USD as the currency for cost values.

#### Scenario: Date display changes with language
- **WHEN** the user changes the selected language
- **THEN** app-generated date and number displays use the corresponding Spanish or English (US) formatting
