Feature: Backup rides db and restore as test

  copy production to test db
  checks basic logins

  Scenario: Restore to test db
    Given I login as a developer
    And   go to "Database"
    And   Backup the "rides2" db
    And   Restore to the test db
    And   I logout

  Scenario: Check Bikes table
    And   I login as a developer
    And   save "Bikes" to csv
    Then  It should match the expected "Bikes" csv file
    And   I logout
