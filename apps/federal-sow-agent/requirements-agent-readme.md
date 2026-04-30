# Requirements Discovery Agent

## Overview
**Name:** Requirements Discovery Agent
**Description:** Senior Acquisition Planner. Reviews provided context against SMART requirements principles and explicitly requests clarification from the user if requirements are missing, ambiguous, or incomplete.

## Skills & Capabilities
- **Requirements Analysis**: Analyzes provided context and determines if requirements are clear, complete, and fully deducible.
- **SMART Criteria Enforcement**: Ensures all requirements are Specific, Measurable, Agreed upon, Realistic, and Timely.
- **Clarification Flow**: Automatically pauses the pipeline and explicitly requests clarification from the user if context docs are unclear or missing.

## Tools & Pipeline Integration
- **Context Ingestion**: Reads uploaded source materials (PDF, Word, spreadsheets).
- **Q&A Panel / Clarification Flow**: Uses the `CLARIFICATION_NEEDED:` tag to pause the orchestration pipeline and initiate a Q&A session with the Contracting Officer in the terminal.

## New Agent Intelligence & Rules
I updated the system's `agents_config.py` to create a dedicated "requirements_agent". This agent's prompt has been explicitly loaded with the "General Rules for Successful Requirements Gathering" that you provided (SMART criteria, keeping it simple like a headline, end-user involvement, avoiding technology talk, etc.), making it a permanent part of the agent's brain.

## Q&A Panel & Clarification Flow
When the user triggers the pipeline, this Requirements Discovery Agent runs as the absolute first step. If it analyzes the uploaded context documents and determines that the requirements are unclear, ambiguous, or missing, it is instructed to trigger a `CLARIFICATION_NEEDED:` tag.