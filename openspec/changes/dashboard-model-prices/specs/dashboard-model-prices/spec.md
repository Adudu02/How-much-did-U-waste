## Purpose

Expose the configured API price for each model used in the dashboard's current activity window so users can understand the rates behind their estimated costs.

## ADDED Requirements

### Requirement: Show configured rates for active models
The main dashboard SHALL show each model present in its activity window with its configured input and output price in USD per 1M tokens. Rates SHALL come from the application's effective local pricing data, including configured provider data and local overrides.

#### Scenario: Model has a configured rate
- **WHEN** a model in the dashboard activity window resolves to a configured price
- **THEN** the model section shows its input and output rates in USD per 1M tokens

#### Scenario: Model identifier uses a supported alias form
- **WHEN** an active model identifier includes a provider prefix or dated suffix and the existing pricing lookup resolves it
- **THEN** the dashboard shows the resolved model rate

#### Scenario: Model has no configured rate
- **WHEN** an active model has no matching configured price
- **THEN** the dashboard identifies the model as lacking a rate and shows no numeric price

#### Scenario: No models are present in the activity window
- **WHEN** the dashboard activity window contains no models
- **THEN** the model section shows its existing empty state
