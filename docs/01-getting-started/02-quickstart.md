# Quickstart Guide

This guide walks you through the core workflow of Tressi using the web interface. We assume you have already installed Tressi and have it running locally (typically at `http://localhost:3108`).

## Step 1: Create a Configuration

The first step is to define what you want to test.

1.  Navigate to the **Configs** page using the navigation bar.
2.  Click the **Create** button (icon: `post_add`) to open the configuration form.
3.  **General Options**: Set the test duration, global rate limits, and other high-level settings.
4.  **Requests**: Add one or more target URLs. You can specify the HTTP method, headers, body, and the desired Requests Per Second (RPS) for each endpoint.
5.  Click **Save** to store your configuration.

## Step 2: Navigate to the Dashboard

Once your configuration is saved, you need to select it for execution.

1.  On the **Configs** page, find your configuration card.
2.  Click the **Dashboard** button on the card to navigate directly to the execution view for that config.
3.  Alternatively, use the **Dashboard** button (icon: `browse_activity`) in the top right header to go to the main dashboard and select your configuration from the dropdown menu.

## Step 3: Execute a Test

With a configuration selected, you are ready to generate load.

1.  Click the **Start Test** button in the header.
2.  The test will begin immediately, and a new entry will appear in the **Test List** table below.
3.  The status will change from `pending` to `running` as the worker threads initialize.

## Step 4: Real-time Analysis

Tressi provides immediate feedback as the test progresses.

1.  **Test List Table**: Monitor high-level metrics directly in the table.
2.  **Column Selector**: Use the column selector icon in the table header to choose which metrics (e.g., P99 Latency, RPS, Error Rate) you want to see in real-time.
3.  **Deep Dive**: Click on the running test in the list to navigate to the **Test Details** page.

## Step 5: Deep Dive & Export

The **Test Details** page provides a comprehensive view of the test performance.

1.  **Live Charts**: View real-time charts for Latency, RPS, and Success Rate. These update as data is collected from the worker threads.
2.  **Metrics Grid**: Review detailed statistical breakdowns, including percentiles and status code distributions.
3.  **Export Results**: Once the test is complete (or while it is running), you can export the data. Click the **Export** button (icon: `save_as`) in the header to download the results in **JSON**, **XLSX**, or **Markdown** format.
