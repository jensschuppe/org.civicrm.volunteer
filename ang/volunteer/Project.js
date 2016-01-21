(function(angular, $, _) {

  angular.module('volunteer').config(function($routeProvider) {
      $routeProvider.when('/volunteer/manage/:projectId', {
        controller: 'VolunteerProject',
        templateUrl: '~/volunteer/Project.html',
        resolve: {
          countries: function(crmApi) {
            return crmApi('VolunteerUtil', 'getcountries', {}).then(function(result) {
              return result.values;
            });
          },
          project: function(crmApi, $route) {
            if ($route.current.params.projectId == 0) {
              return {
                // default new projects to active
                is_active: "1",
                id: 0
              };
            } else {
              return crmApi('VolunteerProject', 'getsingle', {
                id: $route.current.params.projectId
              }).then(
                // success
                null,
                // error
                function () {
                  CRM.alert(
                    ts('No volunteer project exists with an ID of %1', {1: $route.current.params.projectId}),
                    ts('Not Found'),
                    'error'
                  );
                }
              );
            }
          },
          supporting_data: function(crmApi) {
            return crmApi('VolunteerUtil', 'getsupportingdata', {
              controller: 'VolunteerProject'
            });
          },
          campaigns: function(crmApi) {
            return crmApi('VolunteerUtil', 'getcampaigns').then(function(data) {
              return data.values;
            });
          },
          relationship_data: function(crmApi, $route) {
            return crmApi('VolunteerProjectContact', 'get', {
              "sequential": 1,
              "project_id": $route.current.params.projectId
            });
          },
          location_blocks: function(crmApi) {
            return crmApi('VolunteerProject', 'locations', {});
          },
          profile_status: function(crmProfiles) {
            return crmProfiles.load();
          },
          // VOL-174
          userCanGetContactList: function (crmApi) {
            return crmApi('Contact', 'getlist').then(function(result) {
              return (result.count > 1);
            });
          }
        }
      });
    }
  );


  angular.module('volunteer').controller('VolunteerProject', function($scope, $location, $q, $route, crmApi, crmUiAlert, crmUiHelp, countries, project, profile_status, campaigns, relationship_data, supporting_data, location_blocks, volBackbone, userCanGetContactList) {
    // The ts() and hs() functions help load strings for this module.
    var ts = $scope.ts = CRM.ts('org.civicrm.volunteer');
    var hs = $scope.hs = crmUiHelp({file: 'CRM/Volunteer/Form/Volunteer'}); // See: templates/CRM/volunteer/Project.hlp

    var relationships = {};
    if(project.id == 0) {
      relationships = supporting_data.values.defaults.relationships;
      var originalRelationships = {};
      if (CRM.VolunteerAngularSettings.entity_table) {
        project.entity_table = CRM.VolunteerAngularSettings.entity_table;
        project.entity_id = CRM.VolunteerAngularSettings.entity_id;
      }
      //For an associated Entity, make the title of the project default to
      //The title of the entity
      if(CRM.VolunteerAngularSettings.entity_title) {
        project.title = CRM.VolunteerAngularSettings.entity_title;
      }
    } else {
      $(relationship_data.values).each(function (index, relationship) {
        if (!relationships.hasOwnProperty(relationship.relationship_type_id)) {
          relationships[relationship.relationship_type_id] = [];
        }
        relationships[relationship.relationship_type_id].push(relationship.contact_id);
      });
      var originalRelationships = _.clone(relationships);
    }
    project.project_contacts = relationships;

    if(CRM.VolunteerAngularSettings && CRM.VolunteerAngularSettings.use_evented_buttons) {
      $scope.useEventedButtons = true;
    } else {
      $scope.useEventedButtons = false;
    }


    $scope.countries = countries;
    $scope.locationBlocks = location_blocks.values;
    $scope.locationBlocks[0] = "Create a new Location";
    $scope.locBlock = {};
    if (_.isEmpty(project.profiles)) {
      project.profiles = [{
        "is_active": "1",
        "module": "CiviVolunteer",
        "entity_table": "civicrm_volunteer_project",
        "weight": "1",
        "module_data": {audience: "primary"},
        "uf_group_id": supporting_data.values.defaults.profile
      }];
    } else {
      $.each(project.profiles, function (key, data) {
        if(data.module_data) {
          data.module_data = JSON.parse(data.module_data);
        }
      });
    }
    $scope.campaigns = campaigns;
    $scope.relationship_types = supporting_data.values.relationship_types;
    $scope.phone_types = supporting_data.values.phone_types;
    $scope.supporting_data = supporting_data.values;
    $scope.profile_status = profile_status;
    project.is_active = (project.is_active == "1");
    $scope.project = project;
    $scope.profiles = $scope.project.profiles;
    $scope.relationships = $scope.project.project_contacts;
    $scope.userCanGetContactList = userCanGetContactList;

    $scope.refreshLocBlock = function() {
      if (!!$scope.project.loc_block_id) {
        crmApi("VolunteerProject", "getlocblockdata", {
          "return": "all",
          "sequential": 1,
          "id": $scope.project.loc_block_id
        }).then(function(result) {
          if(!result.is_error) {
            $scope.locBlock = result.values[0];
          } else {
            CRM.alert(result.error);
          }
        });
      }
    };
    //Refresh as soon as we are up and running because we don't have this data yet.
    $scope.refreshLocBlock();

    $scope.locBlockChanged = function() {
      if($scope.project.loc_block_id == 0) {
        $scope.locBlock = {
          address: {
            country: _.findWhere(countries, {is_default: "1"}).id
          }
        };

        $("#crm-vol-location-block .crm-accordion-body").slideDown({complete: function() {
          $("#crm-vol-location-block .crm-accordion-wrapper").removeClass("collapsed");
        }});
      } else {
        //Load the data from the server.
        $scope.refreshLocBlock();
      }
    };
    $scope.locBlockDirty = function() {
      $scope.locBlockIsDirty = true;
    };

    $scope.addProfile = function() {
      $scope.profiles.push({
        "entity_table": "civicrm_volunteer_project",
        "is_active": "1",
        "module": "CiviVolunteer",
        "module_data": {audience: "primary"},
        "weight": getMaxProfileWeight() + 1
      });
    };

    var getMaxProfileWeight = function() {
      var weights = [0];
      $.each($scope.profiles, function (index, data) {
        weights.push(parseInt(data.weight));
      });
      return _.max(weights);
    };

    $scope.removeProfile = function(index) {
      $scope.profiles.splice(index, 1);
    };

    $scope.validateProfileSelections = function() {
      var hasAdditionalProfileType = false;
      var hasPrimaryProfileType = false;
      var valid = true;

      $.each($scope.profiles, function (index, data) {
        if(!data.uf_group_id) {
          CRM.alert(ts("Please select at least one profile, and remove empty selections"), "Required", 'error');
          valid = false;
        }

        if(data.module_data.audience == "additional" || data.module_data.audience == "both") {
          if(hasAdditionalProfileType) {
            CRM.alert(ts("You may only have one profile that is used for group registrations"), ts("Warning"), 'error');
            valid = false;
          } else {
            hasAdditionalProfileType = true;
          }
        }

        if (data.module_data.audience == "primary" || data.module_data.audience == "both") {
          hasPrimaryProfileType = true;
        }
      });

      if (!hasPrimaryProfileType) {
        CRM.alert(ts("Please select at least one profile that is used for individual registrations"), ts("Warning"), 'error');
        valid = false;
      }

      return valid;
    };

    $scope.validateProject = function() {
      var valid = true;
      var relationshipsValid = validateRelationships();

      if(!$scope.project.title) {
        CRM.alert(ts("Title is a required field"), "Required");
        valid = false;
      }

      if ($scope.profiles.length === 0) {
        CRM.alert(ts("You must select at least one Profile"), "Required");
        valid = false;
      }

      valid = (valid && relationshipsValid && $scope.validateProfileSelections());

      return valid;
    };

  /**
   * Helper validation function.
   *
   * Ensures that a value is set for each required project relationship.
   *
   * @returns {Boolean}
   */
    validateRelationships = function() {
      var isValid = true;

      var requiredRelationshipTypes = ['volunteer_beneficiary', 'volunteer_manager', 'volunteer_owner'];

      _.each(requiredRelationshipTypes, function(value) {
        var thisRelType = _.find(supporting_data.values.relationship_types, function(relType) {
          return (relType.name === value);
        });

        if (_.isEmpty(relationships[thisRelType.value])) {
          CRM.alert(ts("The %1 relationship must not be blank.", {1: thisRelType.label}), ts("Required"));
          isValid = false;
        }
      });

      return isValid;
    };

    /**
     * Helper function which actually saves a form submission.
     *
     * @returns {Mixed} Returns project ID on success, boolean FALSE on failure.
     */
    saveProject = function() {
      if ($scope.validateProject()) {

        $.each($scope.project.profiles, function (index, data) {
           data.module_data = JSON.stringify(data.module_data);
        });

        if($scope.project.loc_block_id == 0) {
          $scope.locBlockIsDirty = true;
        }
        return crmApi('VolunteerProject', 'create', $scope.project).then(function(result) {
          var projectId = result.values.id;

          //Save the LocBlock
          if($scope.locBlockIsDirty) {
            $scope.locBlock.entity_id = projectId;
            $scope.locBlock.id = result.values.loc_block_id;
            crmApi('VolunteerProject', 'savelocblock', $scope.locBlock);
          }

          return projectId;
        });
      } else {
        return $q.reject(false);
      }
    };

    $scope.saveAndDone = function() {
      saveProject().then(function(projectId) {
        if (projectId) {
          crmUiAlert({text: ts('Changes saved successfully'), title: ts('Saved'), type: 'success'});
          if($scope.useEventedButtons) {
            //Trigger event
            CRM.$("body").trigger("volunteerProjectSaveComplete", projectId);
          } else {
            $location.path( "/volunteer/manage" );
          }
        }
      });
    };

    $scope.saveAndNext = function() {
      saveProject().then(function(projectId) {
        if (projectId) {
          crmUiAlert({text: ts('Changes saved successfully'), title: ts('Saved'), type: 'success'});

          volBackbone.load().then(function() {
            CRM.volunteerPopup(ts('Define Needs'), 'Define', projectId);
            $location.path( "/volunteer/manage" );
          });
        }
      });
    };

    $scope.cancel = function() {
      if($scope.useEventedButtons) {
        //Trigger event
        CRM.$("body").trigger("volunteerProjectCancel");
      } else {
        $location.path( "/volunteer/manage" );
      }
    };

    //Handle Refresh requests
    CRM.$("body").on("volunteerProjectRefresh", function() {
      $route.reload();
    });


  });

})(angular, CRM.$, CRM._);
