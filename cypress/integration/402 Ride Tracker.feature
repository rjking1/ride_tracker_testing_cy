Feature: Ride Tracker

  same rides2 database with quick and basic frontend for phone

  Scenario: Check Ride tracker
    Given I login to Ride Tracker
    Then  I check the stats are within reason
    When  I add a ride
    Then  check the ride is the most recent
    When  I edit a ride
    Then  check the ride has been edited correctly
